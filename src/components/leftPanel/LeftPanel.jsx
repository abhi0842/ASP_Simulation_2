import { useContext } from "react";
import styles from "./leftPanel.module.css";
import { EcgUnfilter } from "../graph/EcgUnfilter.jsx";
import { EcgFilter } from "../graph/EcgFilter.jsx";
import { EcgNoisy } from "../graph/EcgNoisy.jsx";
import { SimulationContext } from "../../context/SimulationContext.jsx";
import { EcgAR } from "../graph/EcgAR.jsx";

export const LeftPanel = () => {
  const { generateECG, applyNoiseTrigger, filteredECG } = useContext(SimulationContext);
  return (
    <div className={styles.leftPanelContainer}>
      <div className={styles.container}>
        <div>{generateECG && <EcgUnfilter />}</div>
        <div>{applyNoiseTrigger && <EcgNoisy />}</div>
        <div>{filteredECG && <EcgFilter />}</div>
        <div>{filteredECG && <EcgAR />}</div>
      </div>
    </div>
  );
};
