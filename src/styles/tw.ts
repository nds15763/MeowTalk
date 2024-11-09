import { create } from 'twrnc';

const tw = create({
  theme: {
    extend: {
      colors: {
        primary: '#be8fb6',
        background: '#f8ecdd',
        text: '#030303',
      },
      fontFamily: {
        'montserrat': 'Montserrat Alternates',
        'dm-sans': 'DM Sans',
      },
    },
  },
});

export default tw; 