import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { createHintBanner } from './createHintBanner';
import { ICellModel } from '@jupyterlab/cells';

export const requestHint = async (
  docManager: IDocumentManager,
  notebookPanel: NotebookPanel,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel
) => {
  const gradeId = cell.getMetadata('nbgrader')?.grade_id;
  const remainingHints = cell.getMetadata('remaining_hints');

  let status = 'HintRequested';

  if (document.getElementById('hint-banner')) {
    status = 'HintAlreadyExists';
    showDialog({
      title: 'Please review previous hint first',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
  } else if (remainingHints < 1) {
    status = 'NotEnoughHint';
    showDialog({
      title: 'No hint left',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
        })
      ]
    });
  } else {
    const preReflection = settings.get('preReflection').composite as boolean;
    const postReflection = settings.get('postReflection').composite as boolean;

    createHintBanner(docManager, notebookPanel, pioneer, cell, postReflection);

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
          false
        );
      });
    }
  }

  pioneer.exporters.forEach(exporter => {
    pioneer.publishEvent(
      notebookPanel,
      {
        eventName: 'HintRequest',
        eventTime: Date.now(),
        eventInfo: {
          status: status,
          gradeId: gradeId
        }
      },
      exporter,
      false
    );
  });
};
