import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';

export class HintTypeSelectionWidget extends ReactWidget {
  constructor() {
    super();
  }

  getValue(): string | undefined {
    return (
      this.node.querySelector(
        'input[name="hint-info"]:checked'
      ) as HTMLInputElement
    )?.value;
  }

  protected render(): React.ReactElement<any> {
    return (
      <div className="hint-info">
        You can request hints of the following types, but keep in mind you are
        limited in the total number of hints you can request:
        <div>
          <label>
            <span className="hint-request-bar-right-request-button planning">
              Planning
            </span>{' '}
            A hint aimed at helping you start the assignment if you don't know
            where to begin.
          </label>
        </div>
        <div>
          <label>
            <span className="hint-request-bar-right-request-button debugging">
              Debugging
            </span>{' '}
            A hint which considers your partial solution and aims to provide
            insight on why it might not be working as expected.
          </label>
        </div>
        <div>
          <label>
            <span className="hint-request-bar-right-request-button optimizing">
              Optimizing
            </span>{' '}
            A hint which aims to improve your already correct solution, helping
            you optimize the code for best performance or readability.
          </label>
        </div>
      </div>
    );
  }
}
