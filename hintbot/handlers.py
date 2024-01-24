import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

import time
from pathlib import Path
import requests
import os

host_url = "https://gpt-hints-api-202402-3d06c421464e.herokuapp.com/feedback_generation/query/"

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def post(self):
        body = json.loads(self.request.body)
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

        print(f"Received ticket: {response.json()}")

        # Periodically check the status of the ticket and receive the feedback when the job is finished
        print("Waiting for the hint to be generated...")
        request_id = response.json()["request_id"]

        time_limit = 240
        timer = 0
        while timer < time_limit:
            time.sleep(10)
            timer += 10
            response = requests.get(
                host_url,
                params={"request_id": request_id},
            )

            print(response.json(), timer)

            if (response.status_code != 200):
                break

            if response.json()["job_finished"]:
                print(f"Received feedback: {response.json()}")
                self.finish(response.json())
                return

def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "hintbot", "hint")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
