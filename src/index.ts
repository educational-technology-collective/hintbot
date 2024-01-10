import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog, Notification } from '@jupyterlab/apputils';
import { requestAPI } from './handler';

const HINTBOT_API = '';

const createHintBanner = (notebookPanel: NotebookPanel, hint: string) => {
  if (document.getElementById('hint-banner')) {
    return;
  }
  const hintBannerPlaceholder = document.createElement('div');
  hintBannerPlaceholder.id = 'hint-banner-placeholder';
  notebookPanel.content.node.insertBefore(hintBannerPlaceholder, notebookPanel.content.node.firstChild); 

  const hintBanner = document.createElement('div');
  hintBanner.id = 'hint-banner';
  hintBanner.innerText = hint;

  const hintBannerButtonsContainer = document.createElement('div');
  hintBannerButtonsContainer.id = 'hint-banner-buttons-container';

  const hintBannerButtons = document.createElement('div');
  hintBannerButtons.id = 'hint-banner-buttons';
  const helpfulButton = document.createElement('button');
  helpfulButton.classList.add('hint-banner-button');
  helpfulButton.innerText = 'Helpful 👍';
  const unhelpfulButton = document.createElement('button');
  unhelpfulButton.classList.add('hint-banner-button');
  unhelpfulButton.innerText = 'Unhelpful 👎';
  const hintBannerButtonClicked = () => {
    console.log('hint banner button clicked')
    hintBanner.remove();
    hintBannerPlaceholder.remove();
  };
  helpfulButton.onclick = hintBannerButtonClicked;
  unhelpfulButton.onclick = hintBannerButtonClicked;
  hintBannerButtons.appendChild(helpfulButton);
  hintBannerButtons.appendChild(unhelpfulButton);

  hintBannerButtonsContainer.appendChild(hintBannerButtons);
  hintBanner.appendChild(hintBannerButtonsContainer);

  notebookPanel.content.node.parentElement.insertBefore(hintBanner, notebookPanel.content.node);

  console.log('hint banner added');
}

const hintButtonClicked = async (notebookPanel: NotebookPanel, gradeId: string) => {
  console.log('hint button clicked');
  if (document.getElementById('hint-banner')) {
    showDialog({
      title: 'Please review previous hint first',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-About-button jp-mod-reject jp-mod-styled'
        })
      ]
    })
  }
  else {
    // const hint = await requestAPI<any>('hintbot', {
    //   notebookPanel: notebookPanel.content.model.toJSON(),
    //   gradeId: gradeId
    // });
    const hint = 'This is a hint';
    createHintBanner(notebookPanel, hint);
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (
    app: JupyterFrontEnd, 
    notebookTracker: INotebookTracker
  ) => {
    console.log('JupyterLab extension hintbot is activated!');

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;

        const cells = notebookPanel.content.model.cells;
        for (let i = 0; i < cells.length; i++) {
          if (
            cells.get(i).getMetadata('nbgrader') && cells.get(i).getMetadata('nbgrader')?.grade_id && cells.get(i).getMetadata('nbgrader')?.cell_type == 'markdown') {
            const hintButton = document.createElement('button');
            hintButton.classList.add('hint-button');
            hintButton.innerText = 'Hint';
            hintButton.onclick = () => hintButtonClicked(notebookPanel, cells.get(i).getMetadata('nbgrader')?.grade_id);
            notebookPanel.content.widgets[i].node.appendChild(hintButton);
          }
        }
        console.log('hint button added');
      }
    );
  }
};

export default plugin;
