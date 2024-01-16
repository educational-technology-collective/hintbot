import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { requestAPI } from './handler';
import { ReflectionInputWidget } from './ReflectionInputWidget';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';

const HINTBOT_API = '';

const createHintBanner = (
  notebookPanel: NotebookPanel,
  hint: string,
  gradeId: string,
  postReflection: boolean,
  pioneer: IJupyterLabPioneer
) => {
  if (document.getElementById('hint-banner')) {
    return;
  }
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
  const hintBannerButtonClicked = async (evaluation: string) => {
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintEvaluated',
          eventTime: Date.now(),
          eventInfo: {
            gradeId: gradeId,
            evaluation: evaluation
          }
        },
        exporter,
        false
      );
    });
    if (postReflection) {
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

      const postReflectionMessage =
        'Write a brief statement of what you learned from the hint and how you will use it to solve the problem.';
      const dialogResult = await showDialog({
        title: 'Reflection',
        body: new ReflectionInputWidget(postReflectionMessage),
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
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PostReflectionSubmitted',
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
        hintBanner.remove();
        hintBannerPlaceholder.remove();
      }
      if (dialogResult.button.label === 'Cancel') {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PostReflectionCanceled',
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
      hintBanner.remove();
      hintBannerPlaceholder.remove();
    }
  };
  helpfulButton.onclick = () => {
    hintBannerButtonClicked('helpful');
  };
  unhelpfulButton.onclick = () => {
    hintBannerButtonClicked('unhelpful');
  };
  hintBannerButtons.appendChild(helpfulButton);
  hintBannerButtons.appendChild(unhelpfulButton);

  hintBannerButtonsContainer.appendChild(hintBannerButtons);
  hintBanner.appendChild(hintBannerButtonsContainer);

  notebookPanel.content.node.parentElement.insertBefore(
    hintBanner,
    notebookPanel.content.node
  );

  pioneer.exporters.forEach(exporter => {
    pioneer.publishEvent(
      notebookPanel,
      {
        eventName: 'HintBannerAdded',
        eventTime: Date.now(),
        eventInfo: {
          gradeId: gradeId
        }
      },
      exporter,
      false
    );
  });
};

const hintButtonClicked = async (
  notebookPanel: NotebookPanel,
  gradeId: string,
  settings: ISettingRegistry.ISettings,
  pioneer: IJupyterLabPioneer
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

      const preReflectionMessage =
        'Write a brief statement of what the problem is that you are facing and why you think your solution is not working.';
      const dialogResult = await showDialog({
        title: 'Reflection',
        body: new ReflectionInputWidget(preReflectionMessage),
        buttons: [
          Dialog.createButton({ label: 'Cancel' }),
          Dialog.createButton({ label: 'Submit' })
        ]
      });

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
        createHintBanner(notebookPanel, hint, gradeId, postReflection, pioneer);
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
      createHintBanner(notebookPanel, hint, gradeId, postReflection, pioneer);
    }
  }
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'hintbot:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry, IJupyterLabPioneer],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    pioneer: IJupyterLabPioneer
  ) => {
    console.log('JupyterLab extension hintbot is activated!');

    const settings = await settingRegistry.load(plugin.id);

    notebookTracker.widgetAdded.connect(
      async (_, notebookPanel: NotebookPanel) => {
        await notebookPanel.revealed;
        await pioneer.loadExporters(notebookPanel);

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
                settings,
                pioneer
              );
            notebookPanel.content.widgets[i].node.appendChild(hintButton);
          }
        }
      }
    );
  }
};

export default plugin;
