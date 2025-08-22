import React from 'react';
import './CalculatorTable.css';

function CalculatorTable({ rows, onManualInput, filters, onFilterChange }) {
  const headers = [
    "Cultivo",
    "ANO POF",
    "Região",
    "Caso Fórmula",
    "LMR (mg/kg)",
    "HR/MCR (mg/kg)",
    "MREC/STMR (mg/kg)",
    "IMEA (mg/kg p.c./dia)",
    "%DRFA ANVISA",
    "%DRFA SYNGENTA"
  ];

  const anoPOFOptions = ['Todos', '2008', '2017'];
  const uniqueCultivos = [...new Set(rows.map(row => row.cultivo))];

  return (
    <div className="tabela-wrapper">
      <div className="tabela-scroll">
        <table className="tabela-estilizada">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index}>
                  <div className="cabecalho">
                    <span>{header}</span>
                    {(header === "Cultivo" || header === "ANO POF") && (
                      <span className="seta">&#9660;</span>
                    )}
                  </div>
                  {header === "Cultivo" && (
                    <select
                      value={filters.cultivo}
                      onChange={(e) => onFilterChange({ ...filters, cultivo: e.target.value })}
                      className="filtro-select"
                    >
                      <option value="">Todos</option>
                      {uniqueCultivos.map(cultivo => (
                        <option key={cultivo} value={cultivo}>{cultivo}</option>
                      ))}
                    </select>
                  )}
                  {header === "ANO POF" && (
                    <select
                      value={filters.anoPOF}
                      onChange={(e) => onFilterChange({ ...filters, anoPOF: e.target.value })}
                      className="filtro-select"
                    >
                      {anoPOFOptions.map(ano => (
                        <option key={ano} value={ano}>{ano}</option>
                      ))}
                    </select>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="no-data">
                  Nenhum dado disponível.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  <td>{row.cultivo}</td>
                  <td>{row.anoPOF}</td>
                  <td>{row.regiao}</td>
                  <td>{row.caso}</td>
                  <td>
                    <input
                      type="text"
                      value={row.lmr || ''}
                      onChange={(e) => onManualInput(row.cultivo, row.anoPOF, 'lmr', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.hrMCR || ''}
                      onChange={(e) => onManualInput(row.cultivo, row.anoPOF, 'hrMCR', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.mrecSTMR || ''}
                      onChange={(e) => onManualInput(row.cultivo, row.anoPOF, 'mrecSTMR', e.target.value)}
                    />
                  </td>
                  <td>{row.imea}</td>
                  <td>{row.drfaAnvisa}</td>
                  <td>{row.drfaSyngenta}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CalculatorTable;
