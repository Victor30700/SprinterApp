// src/components/ModalPB.jsx
import React from 'react';
import ReactModal from 'react-modal';
import '../styles/ModalPB.css';

ReactModal.setAppElement('#root');

export default function ModalPB({ isOpen, onRequestClose, title, children }) {
  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="modal-content"
      overlayClassName="modal-overlay"
    >
      <h3 className="modal-title">{title}</h3>
      <div className="modal-body">{children}</div>
      <button className="modal-close" onClick={onRequestClose}>
        ✕
      </button>
    </ReactModal>
  );
}