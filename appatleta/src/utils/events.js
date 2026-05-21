// src/utils/events.js

export const EVENTS = [
    // Carreras oficiales
    { key: '100m',      label: '100 metros',       type: 'time',     units: ['s'] },
    { key: '200m',      label: '200 metros',       type: 'time',     units: ['s'] },
    { key: '400m',      label: '400 metros',       type: 'time',     units: ['s'] },
    { key: '800m',      label: '800 metros',       type: 'time',     units: ['s'] },
    { key: '1500m',     label: '1500 metros',      type: 'time',     units: ['s'] },
    { key: '5000m',     label: '5000 metros',      type: 'time',     units: ['s'] },
    { key: '10000m',    label: '10000 metros',     type: 'time',     units: ['s'] },
    { key: '110mh',     label: '110 m Vallas',     type: 'time',     units: ['s'] },
    { key: '400mh',     label: '400 m Vallas',     type: 'time',     units: ['s'] },
    { key: '4x100',     label: 'Relevo 4×100 m',   type: 'time',     units: ['s'] },
    { key: '4x400',     label: 'Relevo 4×400 m',   type: 'time',     units: ['s'] },
  
    // Saltos
    { key: 'longJump',  label: 'Salto de longitud',type: 'distance', units: ['m'] },
    { key: 'tripleJump',label: 'Salto triple',     type: 'distance', units: ['m'] },
    { key: 'highJump',  label: 'Salto de altura',   type: 'distance', units: ['m'] },
    { key: 'poleVault', label: 'Salto con pértiga', type: 'distance', units: ['m'] },
  
    // Lanzamientos
    { key: 'shotPut',   label: 'Lanzamiento peso',  type: 'distance', units: ['m'] },
    { key: 'discus',    label: 'Lanzamiento disco', type: 'distance', units: ['m'] },
    { key: 'javelin',   label: 'Lanzamiento jabalina', type: 'distance', units: ['m'] },
    { key: 'hammer',    label: 'Lanzamiento martillo', type: 'distance', units: ['m'] },
  
    // Distancia libre (no oficial)
    { key: 'custom',    label: 'Distancia personalizada', type: 'distance', units: ['m'] },
  ];
  