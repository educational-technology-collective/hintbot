import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestAPI } from './handler';
import { createHintHistoryBar } from './createHintHistoryBar';
import { showTAReflectionDialog } from './showTAReflectionDialog';

export const createHintBanner = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  cellIndex: number,
  promptGroup: string,
  prompt: string,
  uuid: string,
  preReflection: string,
  hintType: string,
  requestId: string
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
  hintBannerCancelButton.classList.add('hint-banner-cancel-button');
  hintBannerCancelButton.innerText = 'Cancel request';
  hintBanner.appendChild(hintBannerCancelButton);
  hintBannerCancelButton.onclick = async () => {
    await requestAPI('cancel', {
      method: 'POST',
      body: JSON.stringify({
        request_id: requestId
      })
    });
  };

  const hintRequestCompleted = (hintContent: string, requestId: string) => {
    const hintHistory = cell.getMetadata('hintHistory') || [];
    cell.setMetadata('hintHistory', [
      ...hintHistory,
      {
        requestId: requestId,
        isGPT: true,
        hintType: hintType,
        hintContent: hintContent
      }
    ]);
    pioneer.exporters.forEach(exporter => {
      pioneer.publishEvent(
        notebookPanel,
        {
          eventName: 'HintRequestCompleted',
          eventTime: Date.now(),
          eventInfo: {
            hintContent: hintContent,
            gradeId: gradeId,
            requestId: requestId,
            promptGroup: promptGroup,
            prompt: prompt,
            uuid: uuid,
            preReflection: preReflection,
            hintType: hintType
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

    hintBannerButtons.appendChild(unhelpfulButton);
    hintBannerButtons.appendChild(helpfulButton);

    hintBannerButtonsContainer.appendChild(hintBannerButtons);
    hintBanner.appendChild(hintBannerButtonsContainer);

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
              evaluation: evaluation,
              promptGroup: promptGroup,
              prompt: prompt,
              uuid: uuid,
              preReflection: preReflection,
              hintType: hintType
            }
          },
          exporter,
          true
        );
      });
      helpfulButton.remove();
      unhelpfulButton.remove();
      createHintHistoryBar(cell, cellIndex, notebookPanel, pioneer);
    };
    helpfulButton.onclick = () => {
      hintBannerButtonClicked('helpful');
      hintBanner.remove();
      hintBannerPlaceholder.remove();
    };
    unhelpfulButton.onclick = () => {
      hintBannerButtonClicked('unhelpful');
      hintBanner.innerText =
        'Do you want to raise this issue to a member of the instructional team for help?\nInstructors may take up to 24 hours to respond to individual requests, so if your request is sent right before an assignment is due a response may not arrive until after the deadline.\nThe system will email you once a response has been made and you will be able to see instructional team feedback directly in your Jupyter notebook.';
      const cancelTAButton = document.createElement('button');
      cancelTAButton.classList.add('hint-banner-cancel-button');
      cancelTAButton.innerText = 'Cancel';
      const continueTAButton = document.createElement('button');
      continueTAButton.classList.add('hint-banner-button');
      continueTAButton.innerText = 'Continue';
      hintBannerButtons.appendChild(cancelTAButton);
      hintBannerButtons.appendChild(continueTAButton);
      hintBanner.appendChild(hintBannerButtonsContainer);

      cancelTAButton.onclick = () => {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'TARequestCanceled',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                requestId: requestId,
                uuid: uuid
              }
            },
            exporter,
            false
          );
        });
        hintBanner.remove();
        hintBannerPlaceholder.remove();
      };

      continueTAButton.onclick = async () => {
        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'TARequestContinued',
              eventTime: Date.now(),
              eventInfo: {
                gradeId: gradeId,
                requestId: requestId,
                uuid: uuid
              }
            },
            exporter,
            false
          );
        });
        const dialogResult = await showTAReflectionDialog(
          "Could you briefly describe your question? Let us know why the GPT hint didn't help and how we can guide you in the right direction!"
        );

        pioneer.exporters.forEach(exporter => {
          pioneer.publishEvent(
            notebookPanel,
            {
              eventName: 'TAReflection',
              eventTime: Date.now(),
              eventInfo: {
                status: dialogResult.button.label,
                gradeId: gradeId,
                uuid: uuid,
                hintType: hintType,
                // email: dialogResult.value?.email,
                reflection: dialogResult.value?.reflection
              }
            },
            exporter,
            true
          );
        });

        if (dialogResult.button.label === 'Submit') {
          console.log(
            requestId,
            dialogResult.value?.email + '@umich.edu',
            dialogResult.value?.reflection
          );
          const response: any = await requestAPI('ta', {
            method: 'POST',
            body: JSON.stringify({
              request_id: requestId,
              student_email: dialogResult.value?.email + '@umich.edu',
              student_notes: dialogResult.value?.reflection
            })
          });
          console.log('create ta ticket', response);

          if (response.statusCode !== 200) {
            showDialog({
              title: response?.message || 'Error',
              buttons: [
                Dialog.createButton({
                  label: 'Dismiss',
                  className: 'jp-Dialog-button jp-mod-reject jp-mod-styled'
                })
              ]
            });
          } else {
            const hintHistory = cell.getMetadata('hintHistory') || [];
            cell.setMetadata('hintHistory', [
              ...hintHistory,
              {
                requestId: requestId,
                isGPT: false,
                hintType: hintType,
                hintContent: ''
              }
            ]);
            continueTAButton.remove();
            cancelTAButton.remove();
            hintBanner.innerText =
              'Request sent! You will receive a response via email when an instructional team member has reviewed your request.';
            const closeButton = document.createElement('button');
            closeButton.classList.add('hint-banner-cancel-button');
            closeButton.innerText = 'Close';
            hintBannerButtons.appendChild(closeButton);
            hintBanner.appendChild(hintBannerButtonsContainer);
            closeButton.onclick = () => {
              hintBanner.remove();
              hintBannerPlaceholder.remove();
            };
          }
        }
      };
    };
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
            requestId: requestId,
            promptGroup: promptGroup,
            prompt: prompt,
            uuid: uuid,
            preReflection: preReflection,
            hintType: hintType
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

    const remainingHints = cell.getMetadata('remaining_hints');
    remainingHints[hintType] += 1;
    cell.setMetadata('remaining_hints', remainingHints);
    document
      .getElementById(gradeId)
      .querySelector('.' + hintType)
      .querySelector('.hint-quantity').innerHTML = remainingHints[hintType];
    notebookPanel.context.save();

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
            requestId: e?.message,
            promptGroup: promptGroup,
            prompt: prompt,
            uuid: uuid,
            preReflection: preReflection,
            hintType: hintType
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
    const response: any = await requestAPI('reflection', {
      method: 'POST',
      body: JSON.stringify({
        request_id: requestId,
        reflection_question: prompt,
        reflection_answer: preReflection
      })
    });
    console.log('Sent reflection', response);
    if (!response) {
      throw new Error();
    } else {
      const intervalId = setInterval(async () => {
        const response: any = await requestAPI('check', {
          method: 'POST',
          body: JSON.stringify({
            request_id: requestId
          })
        });
        if (response.status === STATUS['Loading']) {
          console.log('loading');
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
          hintRequestError(new Error(requestId));
        }
      }, 1000);
    }
  } catch (e) {
    console.log(e);
    hintRequestError(e as Error);
  }
};
