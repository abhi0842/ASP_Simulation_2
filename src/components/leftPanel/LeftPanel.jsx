import { useContext } from "react";
import styles from "./leftPanel.module.css";
import { EcgUnfilter } from "../graph/EcgUnfilter.jsx";
import { EcgFilter } from "../graph/EcgFilter.jsx";
import { EcgNoisy } from "../graph/EcgNoisy.jsx";
import { SimulationContext } from "../../context/SimulationContext.jsx";
import { EcgUnfilteredPSD } from "../graph/EcgUnfilteredPSD.jsx";
import { EcgFilteredPSD } from "../graph/EcgFilteredPSD.jsx";

export const LeftPanel = () => {
  const { generateECG, applyNoiseTrigger, filteredECG, applypsdTrigger } =
    useContext(SimulationContext);
  return (
    <div className={styles.leftPanelContainer}>
      <div className={styles.container}>
        <div className={styles.psdContainer}>
        {applypsdTrigger && <EcgUnfilteredPSD />}
        {applypsdTrigger && <EcgFilteredPSD />}
        </div>
        <div>{generateECG && <EcgUnfilter />}</div>
        <div>{applyNoiseTrigger && <EcgNoisy />}</div>
        <div>{filteredECG && <EcgFilter />}</div>
        {/* <div className={styles.psdContainer}>
        {applypsdTrigger && <EcgUnfilteredPSD />}
        {applypsdTrigger && <EcgFilteredPSD />}
        </div> */}
      </div>
    </div>
  );
};
