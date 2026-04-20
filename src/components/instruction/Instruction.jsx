import React from "react";
import styles from "./instruction.module.css";

export const Instruction = () => {
  return (
    <div className={styles.box}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>INSTRUCTIONS</h1>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 1: </span>Select an <b>ECG Dataset</b> from the dropdown
            menu (or keep the default synthetic signal). Adjust the{" "}
            <b>Duration</b> and <b>Sampling Rate</b> inputs as needed. Click the{" "}
            <b>"Generate ECG Signal"</b> button (or change sampling/duration) to
            create the signal.
          </p>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 2: </span>Select noise options if available (Baseline
            Wander, Powerline, EMG). Use the controls to add noise and observe
            the corrupted ECG in the <b>Noisy</b> plot.
          </p>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 3: </span>Configure the <b>Autoregression (AR)</b> model:
            <ul>
              <li>
                Set <b>AR Order (p)</b> from the right panel. Start with p = 8.
              </li>
              <li>Click <b>Generate AR Output</b> to run one-step prediction on the selected biosignal.</li>
            </ul>
          </p>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 4: </span>Interpret the results using the <b>Learning Guide</b> above the AR graph:
            <ul>
              <li>The graph overlays <b>Input</b>, <b>Reference</b>, and <b>AR Output</b>.</li>
              <li>Use <b>MSE</b> and <b>Correlation</b> values to judge AR model quality.</li>
              <li>Read the auto interpretation text to decide whether tuning is needed.</li>
            </ul>
          </p>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 5: </span>Do a mini experiment for deeper learning:
            <ul>
              <li>Try AR order values: 4, 8, 16, 24.</li>
              <li>Record MSE and identify the best order for each ECG dataset.</li>
              <li>Add noise and repeat to study AR robustness on biosignals.</li>
            </ul>
          </p>
        </div>

        <div className={styles.card}>
          <p>
            <span>STEP 6 (Report): </span>Write a short conclusion:
            <ul>
              <li>Which AR order gave best output and why?</li>
              <li>How did noise change MSE/correlation?</li>
              <li>What did you learn about AR modeling of ECG biosignals?</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
  );
};
