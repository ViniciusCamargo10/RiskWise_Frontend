import React from "react";
import Sidebar from "../components/Sidebar";
import HelpModal from "../components/HelpModal";
import acuteCropData from '../assets/data/acute_crop.json';



const CropAcuteDietPage = () => {
  return (
    <div className="container">
      <HelpModal />
      <Sidebar />
      <div className="main">
        <div className="title-wrapper">
          <h1 className="crop-title">CROP</h1>
          <h2 className="calculator-title">
            <span className="highlight">ACUTE</span> DIET CALCULATOR
          </h2>
        </div>
      </div>
    </div>
  );
};

export default CropAcuteDietPage;
