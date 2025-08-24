import React from "react";

const HelpModal = () => {
  const email = "vinicius.camargo@syngenta.com";
  const subject = "Ajuda";
  const body = "Olá, preciso de ajuda com...";

  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <>
      <a href={mailtoLink} className="help-button">
        ?
      </a>
    </>
  );
};

export default HelpModal;
