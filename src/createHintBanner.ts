import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { requestAPI } from './handler';
import { createHintHistoryBar } from './createHintHistoryBar'

export const createHintBanner = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  cellIndex: number,
  // postReflection: boolean,
  reflectionQuestion: string,
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
    const hintHistory = cell.getMetadata('hintHistory') || [];
    cell.setMetadata('hintHistory', [...hintHistory, [hintType, hintContent]]);
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
            // reflectionGroup: reflectionGroup,
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
              // reflectionGroup: reflectionGroup,
              uuid: uuid,
              preReflection: preReflection,
              hintType: hintType
            }
          },
          exporter,
          true
        );
      });
      hintBanner.remove();
      hintBannerPlaceholder.remove();
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
            requestId: requestId,
            // reflectionGroup: reflectionGroup,
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

    document.getElementById(gradeId).innerText = `Request Hint (${
      cell.getMetadata('remaining_hints') + 1
    } left for this question)`;

    cell.setMetadata(
      'remaining_hints',
      cell.getMetadata('remaining_hints') + 1
    );

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
            // reflectionGroup: reflectionGroup,
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
        reflection_question: reflectionQuestion,
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
          return;
        } else if (response.status === STATUS['Success']) {
          console.log('success');
          clearInterval(intervalId);
          hintRequestCompleted(JSON.parse(response.result).feedback, requestId);
          createHintHistoryBar(cell, cellIndex, notebookPanel, pioneer);
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
