import { createContext, useContext } from 'react';
import type { UnitSystem } from '../lib/units';

export const UnitsContext = createContext<UnitSystem>('metric');
export const useUnits = () => useContext(UnitsContext);
