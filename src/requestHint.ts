import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { createHintBanner } from './createHintBanner';
import { requestAPI } from './handler';

// const HINTBOT_API = '';

export const requestHint = async (
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer,
  gradeId: string
) => {
  pioneer.exporters.forEach(exporter => {
    pioneer.publishEvent(
      notebookPanel,
      {
        eventName: 'HintRequested',
        eventTime: Date.now(),
        eventInfo: {
          gradeId: gradeId
        }
      },
      exporter,
      false
    );
  });
  const preReflection = settings.get('preReflection').composite as boolean;
  const postReflection = settings.get('postReflection').composite as boolean;
  if (document.getElementById('hint-banner')) {
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintAlreadyExists',
          eventTime: Date.now()
        },
        exporter,
        false
      );
    });
    showDialog({
      title: 'Please review previous hint first',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
  } else {
    // const hint = await requestAPI<any>('hintbot', {
    //   notebookPanel: notebookPanel.content.model.toJSON(),
    //   gradeId: gradeId
    // });
    const hint = 'This is a hint';
    if (preReflection) {
      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'PreReflectionDialogDisplayed',
            eventTime: Date.now(),
            eventInfo: {
              gradeId: gradeId
            }
          },
          exporter,
          false
        );
      });

      const dialogResult = await showReflectionDialog(
        'Write a brief statement of what the problem is that you are facing and why you think your solution is not working.'
      );

      if (dialogResult.button.label === 'Submit') {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PreReflectionSubmitted',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                reflection: dialogResult.value
              }
            },
            exporter,
            false
          );
        });
        createHintBanner(notebookPanel, pioneer, hint, gradeId, postReflection);
      }
      if (dialogResult.button.label === 'Cancel') {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PreReflectionCancelled',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                reflection: dialogResult.value
              }
            },
            exporter,
            false
          );
        });
      }
    } else {
      createHintBanner(notebookPanel, pioneer, hint, gradeId, postReflection);
    }
  }
};
