import json
import os
import requests
import tornado
from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin

HOST_URL = "https://gpt-hints-api-202402-3d06c421464e.herokuapp.com/feedback_generation/query/"

STATUS = {
    "Loading": 0,
    "Success": 1,
    "Cancelled": 2,
    "Error": 3
}

class Job():

    def __init__(self, time_limit, request_id):
        self._time_limit = int(time_limit)
        self._timer = 0
        self._request_id = request_id
        self.status = STATUS["Loading"]
        self.result = None

    @tornado.gen.coroutine
    def run(self):
        while self._timer < self._time_limit:
            if self.status == STATUS["Cancelled"]:
                print('Cancelled')
                return

            yield tornado.gen.sleep(1)
            self._timer += 1

            if self._timer % 10 == 0:
                response = requests.get(
                    HOST_URL,
                    params={"request_id": self._request_id},
                    timeout=10
                )
                print(response.json(), self._timer)

                if response.status_code != 200:
                    print("Error")
                    self.status = STATUS["Error"]
                    return

                if response.json()["job_finished"]:
                    print("Success")
                    self.result = response.json()
                    self.status = STATUS["Success"]
                    return

        print("Timeout")
        self.status = STATUS["Error"] # Timeout

    def cancel(self):
        self.status = STATUS["Cancelled"]

class RouteHandler(ExtensionHandlerMixin, JupyterHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @tornado.web.authenticated
    async def post(self, resource):
        try:
            body = json.loads(self.request.body)
            if resource == "hint":
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

                if response.status_code == 200:
                    request_id = response.json()["request_id"]
                    print(f"Received ticket: {request_id}, waiting for the hint to be generated...")

                    newjob = Job(time_limit=240, request_id=request_id)
                    newjob.run()
                    self.extensionapp.jobs[problem_id] = newjob

                    self.write(json.dumps(response.json()))
                else:
                    self.write("request ticket error")

            elif resource == "check":
                problem_id = body.get('problem_id')
                self.write({
                    "status": self.extensionapp.jobs.get(problem_id).status,
                    "result": self.extensionapp.jobs.get(problem_id).result
                })
                if self.extensionapp.jobs.get(problem_id).status != STATUS["Loading"]:
                    del self.extensionapp.jobs[problem_id]

            elif resource == "cancel":
                problem_id = body.get('problem_id')
                self.extensionapp.jobs[problem_id].cancel()

            else:
                self.set_status(404)

        except Exception as e:
            self.log.error(str(e))
            self.set_status(500)
            self.finish(json.dumps(str(e)))
