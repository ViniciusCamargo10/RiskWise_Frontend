import React from "react";
import Sidebar from "../components/Sidebar";
import HelpModal from "../components/HelpModal";

const CropAcuteDiet = () => {
  return (
    <div className="container">
      <HelpModal />
      <Sidebar />
      <div className="main">
        <h1>
          CROP <span className="highlight">ACUTE</span> DIET CALCULATOR
        </h1>
        {/* Aqui depois vamos colocar os filtros e a tabela */}
      </div>
    </div>
  );
};

export default CropAcuteDiet;
