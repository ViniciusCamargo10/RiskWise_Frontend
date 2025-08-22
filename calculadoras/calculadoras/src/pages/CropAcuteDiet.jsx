import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import HelpModal from "../components/HelpModal";
import CalculatorTable from "../components/CalculatorTable"; // Certifique-se de que o caminho está correto

const CropAcuteDietPage = () => {
  const [filters, setFilters] = useState({ cultivo: '', anoPOF: 'Todos' });

  const rows = [
    {
      cultivo: '',
      anoPOF: '',
      regiao: '',
      caso: '',
      lmr: '',
      hrMCR: '',
      mrecSTMR: '',
      imea: '',
      drfaAnvisa: '',
      drfaSyngenta: '',
    },
  ];

  const handleManualInput = () => {};

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

        {/* Tabela renderizada aqui */}
        <CalculatorTable
          rows={rows}
          onManualInput={handleManualInput}
          filters={filters}
          onFilterChange={setFilters}
        />
      </div>
    </div>
  );
};

export default CropAcuteDietPage;
