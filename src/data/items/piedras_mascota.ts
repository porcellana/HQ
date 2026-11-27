/** Piedras de evolución de mascotas (se compran en el establo). Se consumen al evolucionar desde la pantalla de mascotas. */
import type { ItemDef } from '../schema';

const stone = (id: string, name: string, color: string, description: string): ItemDef => ({
  id, name, kind: 'material', level: 5, value: 160, stackable: true, maxStack: 9, plain: true, icon: { shape: 'gema', color }, description,
});

export default [
  stone('piedra_trueno', 'Piedra de trueno', '#f0e040', 'Crepita de electricidad. Algunas mascotas de agua o planta evolucionan con ella.'),
  stone('piedra_escarcha', 'Piedra de escarcha', '#80d0f0', 'Helada al tacto. Hace evolucionar a ciertas mascotas de tierra.'),
  stone('piedra_solar', 'Piedra solar', '#ffd060', 'Guarda luz de mediodía. Hace evolucionar a ciertas mascotas del desierto.'),
] satisfies ItemDef[];
