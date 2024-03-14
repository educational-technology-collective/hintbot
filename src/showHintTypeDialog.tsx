import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

export class HintTypeSelectionWidget extends ReactWidget {
  constructor() {
    super();
  }

  getValue(): string | undefined {
    return (
      this.node.querySelector(
        'input[name="hint-type"]:checked'
      ) as HTMLInputElement
    )?.value;
  }

  protected render(): React.ReactElement<any> {
    return (
      <div className="hint-type">
        {/* <form> */}
        <div>
          <label>
            {/* <input type="radio" name="hint-type" value="planning" /> */}
            <span className="hint-button planning">Planning</span> Show me how
            to approach the problem step by step
          </label>
        </div>
        <div>
          <label>
            {/* <input
                type="radio"
                name="hint-type"
                value="debugging"
                checked={true}
              /> */}
            <span className="hint-button debugging">Debugging</span> Help me
            debug the code
          </label>
        </div>
        <div>
          <label>
            {/* <input type="radio" name="hint-type" value="optimizing" /> */}
            <span className="hint-button optimizing">Optimizing</span> Assist me
            in optimizing the speed / clarity of my program
          </label>
        </div>
        {/* </form> */}
      </div>
    );
  }
}

// export const showHintTypeDialog = () => {
//   return showDialog({
//     title: 'Reflection',
//     body: new ReflectionInputWidget(),
//     buttons: [
//       Dialog.createButton({ label: 'Cancel ' }),
//       Dialog.createButton({ label: 'Submit' })
//     ],
//     hasClose: false
//   });
// };
