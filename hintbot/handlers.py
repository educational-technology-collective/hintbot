import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

import time
from pathlib import Path
import requests
import os

host_url = "https://gpt-hints-api-202402-3d06c421464e.herokuapp.com/feedback_generation/query/"

class Job():

    def __init__(self, run_sec):
        self.run_sec = int(run_sec)
        self.start_time = None
        self.end_time = None
        self._cancelled = False

    @tornado.gen.coroutine
    def run(self, request_id):
        """ Some job

        The job is simple: sleep for a given number of seconds.
        It could be implemented as:
             yield gen.sleep(self.run_sec)
        but this way makes it not cancellable, so
        it is divided: run 1s sleep, run_sec times 
        """
        self.start_time = time.time()
        deadline = self.start_time + self.run_sec
        while time.time() < deadline:
            if self._cancelled:
                print("Job cancelled")
                return
 
            yield tornado.gen.sleep(10)
            response = requests.get(
                host_url,
                params={"request_id": request_id},
            )

            print(response.json(), time.time())

            if (response.status_code != 200):
                break

            if response.json()["job_finished"]:
                print(f"Received feedback: {response.json()}")
                return response.json()

        self.end_time = time.time()
        print("Time out, job failed")
        return "Time out, job failed"

    def cancel(self):
        """ Cancels job

        Returns None on success,
        raises Exception on error:
        if job is already cancelled or done
        """
        if self._cancelled:
            raise Exception('Job is already cancelled')
        if self.end_time is not None:
            raise Exception('Job is already done')
        self._cancelled = True

    def get_state(self):
        if self._cancelled:
            if self.end_time is None:
                # job might be running still
                # and will be stopped on the next while check
                return 'CANCELING'
            else:
                return 'CANCELLED'
        elif self.end_time is None:
            return 'RUNNING'
        elif self.start_time is None:
            # actually this never will shown
            # as after creation, job is immediately started
            return 'NOT STARTED'
        else:
            return 'DONE'


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def post(self):
        body = json.loads(self.request.body)
        if body.get("resource") == "req":
            student_id = os.getenv('WORKSPACE_ID')
            problem_id = body.get('problem_id')
            buggy_notebook_path = body.get('buggy_notebook_path')
            print(student_id, problem_id, buggy_notebook_path)
            response = requests.post(
                host_url,
                data={
                    "student_id": student_id,
                    "problem_id": problem_id,
                },
                files={"file": ("notebook.ipynb", open(buggy_notebook_path, "rb"))},
            )

            if response.status_code != 200:
                return 'Hint Request Error'

            print(f"Received ticket: {response.json()}")

            # Periodically check the status of the ticket and receive the feedback when the job is finished
            print("Waiting for the hint to be generated...")
            request_id = response.json()["request_id"]

            job = Job(240)
            self.application.jobs[request_id] = job
            self.write('Retrieving hint')
            res = job.run(request_id)

            print("Job Result", res)
        elif body.get("resource") == 'cancel':
            self.application.jobs[request_id].cancel()
            self.write('Hint request Cancelled')


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "hintbot", "hint")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
    web_app.jobs = {}
