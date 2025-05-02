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
                        "port": "9004",
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
                self.finish(json.dumps(os.getenv('VOC_USERID')))
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
                hint_type = body.get('hint_type')
                problem_id = body.get('problem_id')
                buggy_notebook_path = body.get('buggy_notebook_path')
                f = open(buggy_notebook_path, "rb")
                response = requests.post(
                    HOST_URL,
                    json={
                        "method": "POST",
                        "port": "9004",
                        "path": "feedback_generation/query/",
                        "body": {
                            "student_id": os.getenv('VOC_USERID'),
                            "problem_id": problem_id,
                            "hint_type": hint_type,
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
                    self.write(response.json()["body"])
                else:
                    self.write("request ticket error")
            elif resource == "reflection":
                request_id = body.get('request_id')
                reflection_question = body.get('reflection_question')
                reflection_answer = body.get('reflection_answer')
                response = requests.post(
                    HOST_URL,
                    json={
                        "method": "POST",
                        "port": "9004",
                        "path": "feedback_generation/query/",
                        "body": {
                            "request_id": request_id,
                            "reflection_question": reflection_question,
                            "reflection_answer": reflection_answer,
                        }
                    },
                    timeout=10
                )
                if response.status_code == 200:
                    request_id = json.loads(response.json()["body"])["request_id"]
                    print(f"Sent reflection for Request #{request_id}, waiting for the hint to be generated...")

                    newjob = Job(time_limit=240, request_id=request_id)
                    newjob.run()
                    self.extensionapp.jobs[str(request_id)] = newjob

                    self.write(response.json()["body"])
                else:
                    self.write("request ticket error")
            elif resource == "check":
                request_id = body.get('request_id')
                self.write({
                    "status": self.extensionapp.jobs.get(str(request_id)).status,
                    "result": self.extensionapp.jobs.get(str(request_id)).result
                })
                if self.extensionapp.jobs.get(str(request_id)).status != STATUS["Loading"]:
                    del self.extensionapp.jobs[str(request_id)]
            elif resource == "cancel":
                request_id = body.get('request_id')
                self.extensionapp.jobs[str(request_id)].cancel()
            elif resource == "ta":
                request_id = body.get('request_id')
                student_email = body.get('student_email')
                student_notes = body.get('student_notes')
                print(request_id, student_email, student_notes)
                response = requests.post(
                    HOST_URL,
                    json={
                        "method": "POST",
                        "port": "9004",
                        "path": "feedback_generation/request_ta/",
                        "body": {
                            "request_id": request_id,
                            "student_email": student_email,
                            "student_notes": student_notes,
                        }
                    },
                    timeout=10
                )
                if response.json()['statusCode'] == 200:
                    print(f"Successfully submitted a request to instructors: {response.json()}")
                    self.write(response.json())
                elif response.json()['statusCode'] == 400:
                    print(f"Error when submitted a request to instructors: {response.json()}")
                    if "Duplicate request_id" in response.json()["body"]:
                        self.write({"statusCode": 400, "message": "Duplicated request id"})
                    elif "Invalid student_email" in response.json()["body"]:
                        self.write({"statusCode": 400, "message": "Invalid student email"})
                    elif "Error extracting request" in response.json()["body"]:
                        self.write({"statusCode": 400, "message": "Error extracting request"})
                    else:
                        self.write({"statusCode": 400, "message": "Unknown 400 error"})
                else:
                    self.write({"statusCode": '', "message": "Unknown error when submitted a request to instructors"})
            elif resource == "check_ta":
                request_id = body.get('request_id')
                response = requests.post(
                    HOST_URL,
                    json={
                        "method": "GET",
                        "port": "9004",
                        "path": "feedback_generation/request_ta/",
                        "params": {
                            "request_id": request_id
                        }
                    },
                    timeout=10
                )
                print("check_ta", response.json())
                if response.status_code == 200:
                    self.write({"statusCode": 200, "feedback_ready": json.loads(response.json()['body'])['feedback_ready'], "feedback": json.loads(response.json()['body']).get('feedback')})
                elif response.status_code == 400:
                    self.write({"statusCode": 400, "message": "Error extracting request"})
                elif response.status_code == 404:
                    self.write({"statusCode": 404, "message": "Request not found"})
                else:
                    self.write({"statusCode": '', "message": "Unknown error when submitted a request to instructors"})
            else:
                self.set_status(404)

        except Exception as e:
            self.log.error(str(e))
            self.set_status(500)
            self.finish(json.dumps(str(e)))
