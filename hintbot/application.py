from traitlets import List, Dict
from jupyter_server.extension.application import ExtensionApp
from .handlers import RouteHandler

class HintBotApp(ExtensionApp):
    name = "hintbot"
    jobs = {}
 
    def initialize_handlers(self):
        """This function adds the extra request handlers from :mod:`.handlers` module to Jupyter Server's Tornado Web Application.
        """
        try:
            self.handlers.extend([(r"/hintbot/(.*)", RouteHandler)])
        except Exception as e:
            self.log.error(str(e))
            raise e
