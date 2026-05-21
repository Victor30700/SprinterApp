import React from 'react';
import '../styles/LoadingScreen.css';
import { BiLoaderCircle } from 'react-icons/bi';

export default function LoadingScreen() {
  return (
    <div className="loading-background">
      <div className="loading-box">
        <BiLoaderCircle className="loading-icon" />
        <h2 className="loading-text">Cargando...</h2>
      </div>
    </div>
  );
}
