import React from 'react';
import ReactModal from 'react-modal';
import '../styles/ConfirmModal.css';

export default function ConfirmModal({ isOpen, title, children, onConfirm, onCancel, confirmText = 'Sí', cancelText = 'No' }) {
  return (
    <ReactModal
      isOpen={isOpen}
      onRequestClose={onCancel}
      className="modal-content"
      overlayClassName="modal-overlay"
      ariaHideApp={false}
    >
      <h3>{title}</h3>
      <div className="modal-body">{children}</div>
      <div className="modal-footer">
        <button className="btn cancel" onClick={onCancel}>{cancelText}</button>
        <button className="btn confirm" onClick={onConfirm}>{confirmText}</button>
      </div>
    </ReactModal>
  );
}
