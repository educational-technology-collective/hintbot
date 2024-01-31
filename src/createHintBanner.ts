import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { requestAPI } from './handler';

export const createHintBanner = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  postReflection: boolean
) => {
  const gradeId = cell.getMetadata('nbgrader').grade_id;

  const hintBannerPlaceholder = document.createElement('div');
  hintBannerPlaceholder.id = 'hint-banner-placeholder';
  notebookPanel.content.node.insertBefore(
    hintBannerPlaceholder,
    notebookPanel.content.node.firstChild
  );

  const hintBanner = document.createElement('div');
  hintBanner.id = 'hint-banner';
  notebookPanel.content.node.parentElement?.insertBefore(
    hintBanner,
    notebookPanel.content.node
  );
  hintBanner.innerHTML =
    '<p><span class="loader"></span>Retrieving hint... Please do not refresh the page.</p> <p>It usually takes around 2 minutes to generate a hint. You may continue to work on the assignment in the meantime.</p>';

  const hintBannerCancelButton = document.createElement('div');
  hintBannerCancelButton.id = 'hint-banner-cancel-button';
  hintBannerCancelButton.innerText = 'Cancel request';
  hintBanner.appendChild(hintBannerCancelButton);
  hintBannerCancelButton.onclick = async () => {
    await requestAPI('cancel', {
      method: 'POST',
      body: JSON.stringify({
        problem_id: gradeId
      })
    });
  };

  const hintRequestCompleted = (hintContent: string) => {
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintRequestCompleted',
          eventTime: Date.now(),
          eventInfo: {
            hintContent: hintContent,
            gradeId: gradeId
          }
        },
        exporter,
        true
      );
    });
    hintBanner.innerText = hintContent;
    hintBannerCancelButton.remove();

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
              hintContent: hintContent,
              evaluation: evaluation
            }
          },
          exporter,
          true
        );
      });
      if (postReflection) {
        const dialogResult = await showReflectionDialog(
          'Write a brief statement of what you learned from the hint and how you will use it to solve the problem.'
        );

        if (dialogResult.button.label === 'Submit') {
          hintBanner.remove();
          hintBannerPlaceholder.remove();
        }

        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'PostReflection',
              eventTime: Date.now(),
              eventInfo: {
                status: dialogResult.button.label,
                gradeId: gradeId,
                hintContent: hintContent,
                reflection: dialogResult.value
              }
            },
            exporter,
            true
          );
        });
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
    hintBannerButtons.appendChild(unhelpfulButton);
    hintBannerButtons.appendChild(helpfulButton);

    hintBannerButtonsContainer.appendChild(hintBannerButtons);
    hintBanner.appendChild(hintBannerButtonsContainer);
  };

  const hintRequestCancelled = () => {
    hintBanner.remove();
    hintBannerPlaceholder.remove();
    showDialog({
      title: 'Hint Request Cancelled',
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
          eventName: 'HintRequestCancelled',
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

  const hintRequestError = () => {
    hintBanner.remove();
    hintBannerPlaceholder.remove();
    showDialog({
      title: 'Hint Request Error. Please try again later',
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
          eventName: 'HintRequestError',
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

  const STATUS = {
    Loading: 0,
    Success: 1,
    Cancelled: 2,
    Error: 3
  };

  try {
    const response: any = await requestAPI('hint', {
      method: 'POST',
      body: JSON.stringify({
        problem_id: gradeId,
        buggy_notebook_path: notebookPanel.context.path
      })
    });
    console.log('create ticket', response);
    const requestId = response?.request_id;
    if (!requestId) {
      throw new Error('Unable to create ticket');
    } else {
      const intervalId = setInterval(async () => {
        const response: any = await requestAPI('check', {
          method: 'POST',
          body: JSON.stringify({
            problem_id: gradeId
          })
        });

        if (response.status === STATUS['Loading']) {
          console.log('loading');
          return;
        } else if (response.status === STATUS['Success']) {
          console.log('success');
          clearInterval(intervalId);
          hintRequestCompleted(response.result.feedback);
        } else if (response.status === STATUS['Cancelled']) {
          console.log('cancelled');
          clearInterval(intervalId);
          hintRequestCancelled();
        } else {
          clearInterval(intervalId);
          throw new Error('Unable to retrieve hint');
        }
      }, 1000);
    }
  } catch (e) {
    console.log(e);
    hintRequestError();
  }
};
