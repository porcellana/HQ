/**
 * COMPAÑEROS: luchan a tu lado, comentan lo que pasa y aprueban (o no) tus
 * decisiones. Se reclutan hablando con su PNJ (`npc`). Sólo uno a la vez.
 */
import type { CompanionDef } from '../schema';

export default [
  {
    id: 'sira', name: 'Sira', title: 'Cazarrecompensas', npc: 'sira', role: 'ranged',
    look: { cloth: '#4a5a3a', clothDark: '#2a3420', pants: '#3a2a20', hair: '#1a1418', skin: '#b07850', overlay: 'picaro', hat: '#3a4a2a' },
    hpBase: 9, hpPerLevel: 5, ac: 13,
    attack: { name: 'Arco largo', toHit: 4, dice: '1d8', damageType: 'perforante', range: 6 },
    likes: 'Le gusta la justicia dura y el oro bien ganado. Odia a los cultistas y a los que se van de rositas.',
    comments: {
      recluta: ['Pago la mitad por adelantado, ¿eh? Es broma. Vamos.', 'Si alguien te apunta, yo le apunto a él.'],
      mazmorra: ['Huele a goblin. Y a algo peor.', 'Pegada a la pared y en silencio. Como en los viejos tiempos.'],
      jefe: ['Ese es el pez gordo. Su cabeza vale más que todo este agujero.', 'Yo le doy en el ojo. Tú en lo demás.'],
      nivel: ['Te estás volviendo peligroso. Me gusta.'],
      aprueba: ['Bien hecho. Así se hacen las cosas.', 'Eso es justicia.'],
      desaprueba: ['¿En serio? Hay gente que mataría por ese favor.', 'Blando. Demasiado blando.'],
      caido: ['¡Me han... dado...!', 'Sigue tú... ahora te alcanzo...'],
      victoria: ['Esta noche invito yo. Una ronda. Pequeña.'],
      mata: ['Uno menos.', '¿Lo has visto? Directo al cuello.', 'Esa flecha la pongo en la cuenta.'],
    },
  },
  {
    id: 'brann', name: 'Brann', title: 'Mercenario tuerto', npc: 'brann', role: 'melee',
    look: { cloth: '#6a4a3a', clothDark: '#3a2a20', pants: '#2a2420', hair: '#a8642c', skin: '#d9a67a', overlay: 'guerrero', hat: '#7a808c' },
    hpBase: 14, hpPerLevel: 7, ac: 15,
    attack: { name: 'Hacha de guerra', toHit: 4, dice: '1d10', damageType: 'cortante', range: 1 },
    likes: 'Le gustan la piedad y la lealtad (él también desertó una vez). Odia la crueldad gratuita y a los nobles.',
    comments: {
      recluta: ['Un ojo y un hacha. Es todo lo que necesitas.', 'Te cubro la espalda. Tú no me la apuñales.'],
      mazmorra: ['Odio los sitios sin cielo.', 'Por cada paso bajo tierra, un trago cuando salgamos.'],
      jefe: ['Grande. Mejor: más fácil de golpear.', 'Ese... ese es de los que no se rinden. Yo tampoco.'],
      nivel: ['Golpeas como un sargento. Uno bueno.'],
      aprueba: ['Eso ha sido decente. No se ve mucho últimamente.', 'Bien. Hay que tener entrañas para la piedad.'],
      desaprueba: ['No me gusta. No me gusta nada.', 'Eso es lo que haría un noble. Y odio a los nobles.'],
      caido: ['Solo... un rasguño...', '¡Agh! Sigue, sigue...'],
      victoria: ['Lo hemos conseguido. Joder, lo hemos conseguido.'],
      mata: ['¡Al suelo!', 'Siguiente.', 'Ese no se levanta.'],
    },
  },
] satisfies CompanionDef[];
