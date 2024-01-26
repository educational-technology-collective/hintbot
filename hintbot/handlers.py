import json
import time
import os
import requests
import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join


HOST_URL = "https://gpt-hints-api-202402-3d06c421464e.herokuapp.com/feedback_generation/query/"

class Job():

    def __init__(self, time_limit):
        self._time_limit = int(time_limit)
        self._timer = 0
        self._cancelled = False

    @tornado.gen.coroutine
    def run(self, request_id):
        while self._timer < self._time_limit:
            if self._cancelled:
                print("Job cancelled")
                return { "job_finished": False, "feedback": "cancelled" }
            yield tornado.gen.sleep(1)
            self._timer += 1

            if self._timer % 10 == 0:
                response = requests.get(
                    HOST_URL,
                    params={"request_id": request_id},
                    timeout=10
                )

                print(response.json(), time.time())

                if response.status_code != 200:
                    break

                if response.json()["job_finished"]:
                    print(f"Received feedback: {response.json()}")
                    return response.json()

        return {"job_finished": False, "feedback": ""}

    def cancel(self):
        self._cancelled = True


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        if body.get("resource") == "req":
            student_id = os.getenv('WORKSPACE_ID')
            problem_id = body.get('problem_id')
            buggy_notebook_path = body.get('buggy_notebook_path')
            response = requests.post(
                HOST_URL,
                data={
                    "student_id": student_id,
                    "problem_id": problem_id,
                },
                files={"file": ("notebook.ipynb", open(buggy_notebook_path, "rb"))},
                timeout=10
            )

            if response.status_code != 200:
                self.write({"job_finished": False, "feedback": "error"})
                return

            print(f"Received ticket: {response.json()}")
            print("Waiting for the hint to be generated...")
            job = Job(240)
            self.application.jobs[problem_id] = job
            res = await job.run(response.json()["request_id"])

            self.write(res)
            return

        if body.get("resource") == 'cancel':
            problem_id = body.get('problem_id')
            self.application.jobs[problem_id].cancel()
            self.write({"job_finished": False, "feedback": "cancelled"})
            return


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "hintbot", "hint")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
    web_app.jobs = {}
