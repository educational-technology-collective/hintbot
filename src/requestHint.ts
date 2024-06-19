import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { v4 as uuidv4 } from 'uuid';
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
  // hintType: string
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
    const uuid = uuidv4();
    let preReflection = false;
    let postReflection = false;

    const workspace_id: string = await requestAPI('id');
    const reflectionGroup =
      workspace_id
        .split('')
        .map(c => c.charCodeAt(0) - 64)
        .reduce((acc, val) => acc + val, 0) % 3;
    console.log(`Condition ${reflectionGroup}`);

    if (reflectionGroup === 0) {
      preReflection = true;
      postReflection = false;
    } else if (reflectionGroup === 1) {
      preReflection = false;
      postReflection = true;
    } else {
      preReflection = false;
      postReflection = false;
    }

    createHintBanner(
      notebookPanel,
      pioneer,
      cell,
      postReflection,
      reflectionGroup,
      uuid
    );

    cell.setMetadata('remaining_hints', remainingHints - 1);
    document.getElementById(gradeId).innerText = `Hint (${
      remainingHints - 1
    } left for this question)`;
    notebookPanel.context.save();

    if (preReflection) {
      document.getElementById('hint-banner').style.filter = 'blur(10px)';

      const preReflectionPrompts = [
        'Considering your submission and the feedback you have gotten from the system thus far, what are the steps you think must be followed in order to answer this question, and which step is the one you are currently stuck on?',
        'Considering your submission and the feedback you have gotten from the system thus far, which topics in the course do you think are most relevant to the current problem you are facing?',
        'Considering your submission and the feedback you have gotten from the system thus far, is there an alternative approach which you can try to to solve the step of the question you are working on?'
      ];

      const randomIndex = Math.floor(
        Math.random() * preReflectionPrompts.length
      );

      const dialogResult = await showReflectionDialog(
        preReflectionPrompts[randomIndex]
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
              prompt: randomIndex,
              reflection: dialogResult.value,
              reflectionGroup: reflectionGroup,
              uuid: uuid
              // hintType: hintType
            }
          },
          exporter,
          true
        );
      });
      if (dialogResult.button.label === 'Cancel') {
        await requestAPI('cancel', {
          method: 'POST',
          body: JSON.stringify({
            problem_id: gradeId
          })
        });
      }
    }
  }
};
