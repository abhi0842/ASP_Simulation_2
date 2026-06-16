import { useContext } from "react";
import styles from "./topPanel.module.css";
import { SimulationContext } from "../../context/SimulationContext.jsx";
export const TopPanel = () => {
  const { showInstruction, setShowInstruction, buttonRef } =
    useContext(SimulationContext);  
    const toggleInstruction = () => {
        setShowInstruction(!showInstruction);
    }
  return (
    <div className={styles.Container}>
      <div className={styles.panelContainer}>
        <h1>
         Simulate an Autoregressive stochastic process
        </h1>
        <div className={styles.buttonContainer}>
          <button
            ref={buttonRef}
            className={styles.panelButton}
            onClick={toggleInstruction}
          >
            <span className={styles.buttonIcon}>ℹ️</span>
            Instruction
          </button>
        </div>
      </div>
    </div>
  );
};
