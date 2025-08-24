import "./App.css"; // importa os estilos da aplicação
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CropAcuteDiet from "./pages/CropAcuteDiet";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CropAcuteDiet />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
