import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { requestAPI } from './handler';
import React from 'react';

const HINTBOT_API = '';

const createHintBanner = (
  notebookPanel: NotebookPanel,
  hint: string,
  gradeId: string,
  postReflection: boolean
) => {
  if (document.getElementById('hint-banner')) {
    return;
  }
  console.log('creating hint banner');
  const hintBannerPlaceholder = document.createElement('div');
  hintBannerPlaceholder.id = 'hint-banner-placeholder';
  notebookPanel.content.node.insertBefore(
    hintBannerPlaceholder,
    notebookPanel.content.node.firstChild
  );

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
  const hintBannerButtonClicked = async () => {
    console.log('hint banner button clicked');
    if (postReflection) {
      const body = (
        <div className="reflection">
          <label>
            Write a brief statement considering the text given to you by the
            hint. How does this change your approach to the problem?
            <textarea
              name="post-reflection-input"
              className="reflection-input"
              rows={10}
            />
          </label>
        </div>
      );
      const dialogResult = await showDialog({
        title: 'Reflection',
        body,
        buttons: [
          Dialog.createButton({
            label: 'Cancel'
          }),
          Dialog.createButton({
            label: 'Submit'
          })
        ]
      });

      if (dialogResult.button.label === 'Submit') {
        const event = {
          eventName: 'postReflectionSubmitted',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        };
        console.log(event);
        hintBanner.remove();
        hintBannerPlaceholder.remove();
      }
      if (dialogResult.button.label === 'Cancel') {
        const event = {
          eventName: 'postReflectionCanceled',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        };
        console.log(event);
      }
    }
  };
  helpfulButton.onclick = hintBannerButtonClicked;
  unhelpfulButton.onclick = hintBannerButtonClicked;
  hintBannerButtons.appendChild(helpfulButton);
  hintBannerButtons.appendChild(unhelpfulButton);

  hintBannerButtonsContainer.appendChild(hintBannerButtons);
  hintBanner.appendChild(hintBannerButtonsContainer);

  notebookPanel.content.node.parentElement.insertBefore(
    hintBanner,
    notebookPanel.content.node
  );

  console.log('hint banner added');
};

const hintButtonClicked = async (
  notebookPanel: NotebookPanel,
  gradeId: string,
  settings: ISettingRegistry.ISettings
) => {
  console.log('hint button clicked');
  const preReflection = settings.get('preReflection').composite as boolean;
  const postReflection = settings.get('postReflection').composite as boolean;
  if (document.getElementById('hint-banner')) {
    showDialog({
      title: 'Please review previous hint first',
      buttons: [
        Dialog.createButton({
          label: 'Dismiss',
          className: 'jp-About-button jp-mod-reject jp-mod-styled'
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
      console.log('pre reflection');
      const body = (
        <div className="reflection">
          <label>
            Write a brief statement of what the problem is that you are facing
            and why you think your solution is not working.
            <textarea
              name="pre-reflection-input"
              id="pre-reflection-input"
              className="reflection-input"
              rows={10}
            />
          </label>
        </div>
      );
      const dialogResult = await showDialog({
        title: 'Reflection',
        body,
        buttons: [
          Dialog.createButton({ label: 'Cancel' }),
          Dialog.createButton({ label: 'Submit' })
        ]
      });

      if (dialogResult.button.label === 'Submit') {
        const event = {
          eventName: 'preReflectionSubmitted',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        };
        console.log(event);
        createHintBanner(notebookPanel, hint, gradeId, postReflection);
      }
      if (dialogResult.button.label === 'Cancel') {
        const event = {
          eventName: 'preReflectionCanceled',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId
          }
        };
        console.log(event);
        return;
      }
    } else {
      createHintBanner(notebookPanel, hint, gradeId, postReflection);
    }
  }
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry
  ) => {
    console.log('JupyterLab extension hintbot is activated!');

    const settings = await settingRegistry.load(plugin.id);

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;

        const cells = notebookPanel.content.model.cells;
        for (let i = 0; i < cells.length; i++) {
          if (
            cells.get(i).getMetadata('nbgrader') &&
            cells.get(i).getMetadata('nbgrader')?.grade_id &&
            cells.get(i).getMetadata('nbgrader')?.cell_type === 'markdown'
          ) {
            const hintButton = document.createElement('button');
            hintButton.classList.add('hint-button');
            hintButton.innerText = 'Hint';
            hintButton.onclick = () =>
              hintButtonClicked(
                notebookPanel,
                cells.get(i).getMetadata('nbgrader')?.grade_id,
                settings
              );
            notebookPanel.content.widgets[i].node.appendChild(hintButton);
          }
        }
        console.log('hint button added');
      }
    );
  }
};

export default plugin;
