const str = '╪د┘„╪د╪│┘à ╪د┘„┘â╪د┘à┘„ ┘„┘„┘à╪د╪»╪ر';
console.log('latin1:', Buffer.from(str, 'latin1').toString('utf8'));
// We will test several encodings.
