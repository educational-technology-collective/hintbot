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
  // hintType: string
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

  const hintRequestCompleted = (hintContent: string, requestId: string) => {
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintRequestCompleted',
          eventTime: Date.now(),
          eventInfo: {
            hintContent: hintContent,
            gradeId: gradeId,
            requestId: requestId
            // hintType: hintType
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
              requestId: requestId,
              hintContent: hintContent,
              evaluation: evaluation
              // hintType: hintType
            }
          },
          exporter,
          true
        );
      });
      if (postReflection) {
        const postReflectionPrompts = [
          'Considering the hint you just received and your solution thus far, what steps will you take next to move forward on the question?',
          'Considering the hint you just received and your solution thus far, are there other topics from the course material you should be incorporating into your solution?',
          'Considering the hint you just received and your solution thus far, was your general approach a good one, or should you change to an alternative approach to solve the step of the question you are working on?'
        ];

        const randomIndex = Math.floor(
          Math.random() * postReflectionPrompts.length
        );

        const dialogResult = await showReflectionDialog(
          postReflectionPrompts[randomIndex]
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
                requestId: requestId,
                hintContent: hintContent,
                prompt: randomIndex,
                reflection: dialogResult.value
                // hintType: hintType
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

  const hintRequestCancelled = (requestId: string) => {
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
            gradeId: gradeId,
            requestId: requestId
          }
        },
        exporter,
        false
      );
    });
  };

  const hintRequestError = (e: Error) => {
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
            gradeId: gradeId,
            requestId: e?.message
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
        // hint_type: hintType,
        problem_id: gradeId,
        buggy_notebook_path: notebookPanel.context.path
      })
    });
    console.log('create ticket', response);
    const requestId = response?.request_id;
    if (!requestId) {
      throw new Error();
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
          hintRequestCompleted(JSON.parse(response.result).feedback, requestId);
        } else if (response.status === STATUS['Cancelled']) {
          console.log('cancelled');
          clearInterval(intervalId);
          hintRequestCancelled(requestId);
        } else {
          clearInterval(intervalId);
          throw new Error(requestId);
        }
      }, 1000);
    }
  } catch (e) {
    console.log(e);
    hintRequestError(e as Error);
  }
};
