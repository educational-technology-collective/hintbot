import json
import os
import requests
import tornado
from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.extension.handler import ExtensionHandlerMixin

HOST_URL = os.getenv('HOST_URL')

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

            if self._timer % 5 == 0:

                response = requests.post(
                    HOST_URL,
                    json={
                        "method": "GET",
                        "port": "9002",
                        "path": "feedback_generation/query/",
                        "params": {
                            "request_id": self._request_id
                        }
                    },
                    timeout=10
                )
                print(response.json(), self._timer)

                if response.status_code != 200:
                    print("Error")
                    self.status = STATUS["Error"]
                    return

                if json.loads(response.json()["body"])["job_finished"]:
                    print("Success")
                    self.result = response.json()["body"]
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
    async def get(self, resource):
        try:
            self.set_header("Content-Type", "application/json")
            if resource == "version":
                self.finish(json.dumps(__version__))
            elif resource == "id":
                self.finish(json.dumps(os.getenv('WORKSPACE_ID')))
            else:
                self.set_status(404)
        except Exception as e:
            self.log.error(str(e))
            self.set_status(500)
            self.finish(json.dumps(str(e)))
        
    @tornado.web.authenticated
    async def post(self, resource):
        try:
            body = json.loads(self.request.body)
            if resource == "hint":
                # hint_type = body.get('hint_type')
                problem_id = body.get('problem_id')
                buggy_notebook_path = body.get('buggy_notebook_path')
                f = open(buggy_notebook_path, "rb")
                response = requests.post(
                    # f'{HOST_URL}/feedback_generation/query/?method=POST&port=9002&student_id=x&problem_id={problem_id}',
                    HOST_URL,
                    json={
                        "method": "POST",
                        "port": "9002",
                        "path": "feedback_generation/query/",
                        "body": {
                            "student_id": "x",
                            "problem_id": problem_id,
                            "file": json.dumps(json.load(f)),
                        }
                    },
                    # files={"file": ("notebook.json", open(buggy_notebook_path, "rb"))},
                    timeout=10
                )
                f.close()
                if response.status_code == 200:
                    request_id = json.loads(response.json()["body"])["request_id"]
                    print(f"Received ticket: {request_id}, waiting for the hint to be generated...")

                    newjob = Job(time_limit=240, request_id=request_id)
                    newjob.run()
                    self.extensionapp.jobs[problem_id] = newjob

                    self.write(response.json()["body"])
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
