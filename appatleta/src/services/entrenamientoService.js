import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { useAuth } from '../context/AuthContext';
  
  // Obtiene la referencia a la colección de trainings del usuario
  function getTrainingsCollection(uid) {
    return collection(db, 'users', uid, 'trainings');
  }
  
  // Crear un nuevo entrenamiento
  export async function crearEntrenamiento(uid, entrenamientoData) {
    const ref = getTrainingsCollection(uid);
    const docRef = await addDoc(ref, entrenamientoData);
    return docRef.id;
  }
  
  // Leer todos los entrenamientos (ordenados por fecha descendente)
  export async function listarEntrenamientos(uid) {
    const ref = getTrainingsCollection(uid);
    const q = query(ref, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  // Actualizar un entrenamiento existente
  export async function actualizarEntrenamiento(uid, id, datosActualizados) {
    const docRef = doc(db, 'users', uid, 'trainings', id);
    await updateDoc(docRef, datosActualizados);
  }
  
  // Eliminar un entrenamiento
  export async function eliminarEntrenamiento(uid, id) {
    const docRef = doc(db, 'users', uid, 'trainings', id);
    await deleteDoc(docRef);
  }
  