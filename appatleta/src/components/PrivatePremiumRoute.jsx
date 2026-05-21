import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function PrivatePremiumRoute({ children }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const [isAllowed, setIsAllowed] = useState(null);

  useEffect(() => {
    const checkPremium = async () => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const data = snap.data();
        setIsAllowed(data?.isPremium || false);
      } else {
        setIsAllowed(false);
      }
    };
    checkPremium();
  }, [user]);

  if (isAllowed === null) return null; // loading...

  return isAllowed ? children : <Navigate to="/home" replace />;
}
