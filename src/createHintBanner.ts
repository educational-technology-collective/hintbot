import { NotebookPanel } from '@jupyterlab/notebook';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ICellModel } from '@jupyterlab/cells';
import { IJupyterLabPioneer } from 'jupyterlab-pioneer';
import { showReflectionDialog } from './showReflectionDialog';
import { requestAPI } from './handler';

// function fetchHint() {
//   return new Promise<string>(resolve => {
//     setTimeout(() => {
//       resolve('This is a hint.');
//       console.log(1);
//     }, 20000);
//   });
// }

export const createHintBanner = async (
  notebookPanel: NotebookPanel,
  pioneer: IJupyterLabPioneer,
  cell: ICellModel,
  postReflection: boolean
) => {
  const gradeId = cell.getMetadata('nbgrader').grade_id;
  const remainingHints = cell.getMetadata('remaining_hints');

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

  hintBanner.innerText =
    'Retrieving hint... Please do not refresh the page. \n \n (It usually takes around 2 minutes to generate a hint. \n You may continue to work on the assignment in the meantime)';

  try {
    const requestBody = {
      problem_id: gradeId,
      buggy_notebook_path: notebookPanel.context.path
    };
    const response: any = await requestAPI('hint', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    if (response.job_finished && response.feedback) {
      const hintContent = response.feedback;
      hintBanner.innerText = hintContent;
      cell.setMetadata('remaining_hints', remainingHints - 1);
      document.getElementById(gradeId).innerText = `Hint (${
        remainingHints - 1
      } left)`;
      notebookPanel.context.save();

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
                  reflection: dialogResult.value
                }
              },
              exporter,
              false
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
    } else {
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
    }
  } catch (e) {
    console.log(e);
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
  }
};
