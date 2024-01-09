import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { requestAPI } from './handler';

/**
 * Initialization data for the hintbot extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension hintbot is activated!');

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('hintbot settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for hintbot.', reason);
        });
    }

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The hintbot server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
