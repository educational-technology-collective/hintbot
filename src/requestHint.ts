import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { createHintBanner } from './createHintBanner';
import { ICellModel } from '@jupyterlab/cells';
import { requestAPI } from './handler';

export const requestHint = async (
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel
) => {
  const gradeId = cell.getMetadata('nbgrader')?.grade_id;
  const remainingHints = cell.getMetadata('remaining_hints');

  if (document.getElementById('hint-banner')) {
    showDialog({
      title: 'Please review previous hint first.',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintAlreadyExists',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        },
        exporter,
        false
      );
    });
  } else if (remainingHints < 1) {
    showDialog({
      title: 'No hint left for this question.',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'NotEnoughHint',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        },
        exporter,
        false
      );
    });
  } else {
    const preReflection = settings.get('preReflection').composite as boolean;
    const postReflection = settings.get('postReflection').composite as boolean;

    createHintBanner(notebookPanel, pioneer, cell, postReflection);

    cell.setMetadata('remaining_hints', remainingHints - 1);
    document.getElementById(gradeId).innerText = `Hint (${
      remainingHints - 1
    } left for this question)`;
    notebookPanel.context.save();

    if (preReflection) {
      document.getElementById('hint-banner').style.filter = 'blur(10px)';

      const dialogResult = await showReflectionDialog(
        'Write a brief statement of what the problem is that you are facing and why you think your solution is not working.'
      );
      document.getElementById('hint-banner').style.filter = 'none';

      pioneer.exporters.forEach(exporter => {
        pioneer.publishEvent(
          notebookPanel,
          {
            eventName: 'PreReflection',
            eventTime: Date.now(),
            eventInfo: {
              status: dialogResult.button.label,
              gradeId: gradeId,
              reflection: dialogResult.value
            }
          },
          exporter,
          true
        );
      });
      if (dialogResult.button.label === 'Cancel') {
        await requestAPI('hint', {
          method: 'POST',
          body: JSON.stringify({
            resource: 'cancel',
            problem_id: gradeId
          })
        });
      }
    }
  }
};
