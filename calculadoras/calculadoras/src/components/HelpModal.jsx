import React, { useState } from "react";

const HelpModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="help-button" onClick={() => setOpen(true)}>
        ?
      </button>

      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="close" onClick={() => setOpen(false)}>
              &times;
            </span>
            <h2>Contato do Responsável</h2>
            <p>vinicius.camargo@syngenta.com</p>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpModal;
