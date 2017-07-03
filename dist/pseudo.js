



// Preprocessor








// A kind of helper for various data manipulation
function union(size) {
  const bfr = new ArrayBuffer(size);

  return {
    uw: new Uint32Array(bfr),
    uh: new Uint16Array(bfr),
    ub: new Uint8Array (bfr),

    sw: new Int32Array(bfr),
    sh: new Int16Array(bfr),
    sb: new Int8Array (bfr),
  };
}

// Declare our namespace
'use strict';
const pseudo = window.pseudo || {};





























































































pseudo.CstrBus = (function() {
  const interrupt = [{
    code: 0,
    dest: 1
  }, {
    code: 1,
    dest: 1
  }, {
    code: 2,
    dest: 4
  }, {
    code: 3,
    dest: 1
  }, {
    code: 4,
    dest: 1
  }, {
    code: 5,
    dest: 1
  }, {
    code: 6,
    dest: 1
  }, {
    code: 7,
    dest: 8
  }, {
    code: 8,
    dest: 8
  }, {
    code: 9,
    dest: 1
  }, {
    code: 10,
    dest: 1
  }];

  // Exposed class functions/variables
  return {
    reset() {
      for (let irq of interrupt) {
        irq.queued = 0;
      }
    },

    interruptsUpdate() {
      for (let irq of interrupt) {
        if (irq.queued) {
          if (irq.queued++ === irq.dest) {
            pseudo.CstrMem._hwr.uh[((0x1070)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1] |= (1<<irq.code);
            irq.queued = 0;
            break;
          }
        }
      }
    },

    interruptSet(n) {
      interrupt[n].queued = 1;
    },

    checkDMA(addr, data) {
      const chan = ((addr>>>4)&0xf) - 8;

      if (pseudo.CstrMem._hwr.uw[((0x10f0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&(8<<(chan*4))) { // GPU does not execute sometimes
        pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|8)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data;

        switch(chan) {
          case 2: pseudo.CstrGraphics .executeDMA(addr); break; // GPU
          case 6: pseudo.CstrMem.executeDMA(addr); break; // OTC

          default:
            pseudo.CstrMain.error('DMA Channel '+chan);
            break;
        }
        pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|8)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data&(~(0x01000000));

        if (pseudo.CstrMem._hwr.uw[((0x10f4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&(1<<(16+chan))) {
          pseudo.CstrMem._hwr.uw[((0x10f4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] |= 1<<(24+chan);
          pseudo.CstrBus.interruptSet(3);
        }
      }
    }
  };
})();












pseudo.CstrCounters = (function() {
  let timer;
  let vbk;

  // Exposed class functions/variables
  return {
    awake() {
      timer = [];
    },

    reset() {
      for (let i=0; i<3; i++) {
        timer[i] = {
          bound: 0xffff
        };
      }

      vbk = 0;
    },

    update() {
      if ((vbk += 64) === 33868800/60) { vbk = 0;
        pseudo.CstrBus.interruptSet(0);
      }
    }
  };
})();


pseudo.CstrHardware = (function() {
  // Exposed class functions/variables
  return {
    write: {
      w(addr, data) {
        addr&=0xffff;

        if (addr >= 0x0000 && addr <= 0x03ff) { // Scratchpad
          pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data;
          return;
        }

        if (addr >= 0x1080 && addr <= 0x10e8) { // DMA
          if (addr&8) {
            pseudo.CstrBus.checkDMA(addr, data);
            return;
          }
          pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data;
          return;
        }

        if (addr >= 0x1114 && addr <= 0x1118) { // Rootcounters
          pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data;
          return;
        }

        if (addr >= 0x1810 && addr <= 0x1814) { // Graphics
          pseudo.CstrGraphics.scopeW(addr, data);
          return;
        }

        switch(addr) {
          case 0x1070:
            pseudo.CstrMem._hwr.uw[((0x1070)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] &= data&pseudo.CstrMem._hwr.uw[((0x1074)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2];
            return;

          case 0x10f4: // Thanks Calb, Galtor :)
            pseudo.CstrMem._hwr.uw[((0x10f4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = (pseudo.CstrMem._hwr.uw[((0x10f4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&(~((data&0xff000000)|0xffffff)))|(data&0xffffff);
            return;

          
          case 0x1000:
          case 0x1004:
          case 0x1008:
          case 0x100c:
          case 0x1010:
          case 0x1014:
          case 0x1018:
          case 0x101c:
          case 0x1020:
          case 0x1060:
          case 0x1074:
          case 0x10f0:
            pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] = data;
            return;
        }
        pseudo.CstrMain.error('Hardware Write w '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      },

      h(addr, data) {
        addr&=0xffff;

        if (addr >= 0x1100 && addr <= 0x1128) { // Rootcounters
          pseudo.CstrMem._hwr.uh[(( addr)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1] = data;
          return;
        }
        
        if (addr >= 0x1c00 && addr <= 0x1dfe) { // Audio
          pseudo.CstrMem._hwr.uh[(( addr)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1] = data;
          return;
        }

        switch(addr) {
          case 0x1070:
            pseudo.CstrMem._hwr.uh[((0x1070)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1] &= data&pseudo.CstrMem._hwr.uh[((0x1074)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1];
            return;

          
          case 0x1074:
            pseudo.CstrMem._hwr.uh[(( addr)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1] = data;
            return;
        }
        pseudo.CstrMain.error('Hardware Write h '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      },

      b(addr, data) {
        addr&=0xffff;
        
        switch(addr) {
          
          case 0x2041: // DIP Switch?
            pseudo.CstrMem._hwr.ub[(( addr)&(pseudo.CstrMem._hwr.ub.byteLength-1))>>>0] = data;
            return;
        }
        pseudo.CstrMain.error('Hardware Write b '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      }
    },

    read: {
      w(addr) {
        addr&=0xffff;

        if (addr >= 0x1080 && addr <= 0x10e8) { // DMA
          return pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2];
        }

        if (addr >= 0x1110 && addr <= 0x1110) { // Rootcounters
          return pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2];
        }

        if (addr >= 0x1810 && addr <= 0x1814) { // Graphics
          return pseudo.CstrGraphics.scopeR(addr);
        }

        switch(addr) {
          
          case 0x1070:
          case 0x1074:
          case 0x10f0:
          case 0x10f4:
            return pseudo.CstrMem._hwr.uw[(( addr)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2];
        }
        pseudo.CstrMain.error('Hardware Read w '+('0x'+(addr>>>0).toString(16)));
      },

      h(addr) {
        addr&=0xffff;

        if (addr >= 0x1c0c && addr <= 0x1dae) { // Audio
          return pseudo.CstrMem._hwr.uh[(( addr)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1];
        }

        switch(addr) {
          
          case 0x1070:
          case 0x1074:
            return pseudo.CstrMem._hwr.uh[(( addr)&(pseudo.CstrMem._hwr.uh.byteLength-1))>>>1];
        }
        pseudo.CstrMain.error('Hardware Read h '+('0x'+(addr>>>0).toString(16)));
      }
    }
  };
})();









pseudo.CstrMem = (function() {
  // Exposed class functions/variables
  return {
    _ram: union(0x200000),
    _rom: union(0x80000),
    _hwr: union(0x4000),

    reset() {
      // Reset all, except for BIOS?
      pseudo.CstrMem._ram.ub.fill(0);
      pseudo.CstrMem._hwr.ub.fill(0);
    },

    write: {
      w(addr, data) {
        switch(addr>>>24) {
          case 0x00: // Base
          case 0x80: // Mirror
          case 0xa0: // Mirror
            if (pseudo.CstrR3ka.writeOK()) {
              pseudo.CstrMem._ram.uw[(( addr)&(pseudo.CstrMem._ram.uw.byteLength-1))>>>2] = data;
            }
            return;

          case 0x1f: // Hardware
            pseudo.CstrHardware.write.w(addr, data);
            return;
        }

        if (addr === 0xfffe0130) { // Mem Access
          return;
        }
        pseudo.CstrMain.error('Mem Write w '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      },

      h(addr, data) {
        switch(addr>>>24) {
          case 0x00: // Base
          case 0x80: // Mirror
            pseudo.CstrMem._ram.uh[(( addr)&(pseudo.CstrMem._ram.uh.byteLength-1))>>>1] = data;
            return;

          case 0x1f: // Hardware
            pseudo.CstrHardware.write.h(addr, data);
            return;
        }
        pseudo.CstrMain.error('Mem Write h '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      },

      b(addr, data) {
        switch(addr>>>24) {
          case 0x00: // Base
          case 0x80: // Mirror
          case 0xa0: // Mirror
            pseudo.CstrMem._ram.ub[(( addr)&(pseudo.CstrMem._ram.ub.byteLength-1))>>>0] = data;
            return;

          case 0x1f: // Hardware
            pseudo.CstrHardware.write.b(addr, data);
            return;
        }
        pseudo.CstrMain.error('Mem Write b '+('0x'+(addr>>>0).toString(16))+' <- '+('0x'+(data>>>0).toString(16)));
      }
    },

    read: {
      w(addr) {
        switch(addr>>>24) {
          case 0x00: // Base
          case 0x80: // Mirror
          case 0xa0: // Mirror
            return pseudo.CstrMem._ram.uw[(( addr)&(pseudo.CstrMem._ram.uw.byteLength-1))>>>2];

          case 0xbf: // BIOS
            return pseudo.CstrMem._rom.uw[(( addr)&(pseudo.CstrMem._rom.uw.byteLength-1))>>>2];

          case 0x1f: // Hardware
            return pseudo.CstrHardware.read.w(addr);
        }
        pseudo.CstrMain.error('Mem Read w '+('0x'+(addr>>>0).toString(16)));
        return 0;
      },

      h(addr) {
        switch(addr>>>24) {
          case 0x80: // Mirror
            return pseudo.CstrMem._ram.uh[(( addr)&(pseudo.CstrMem._ram.uh.byteLength-1))>>>1];

          case 0x1f: // Hardware
            return pseudo.CstrHardware.read.h(addr);
        }
        pseudo.CstrMain.error('Mem Read h '+('0x'+(addr>>>0).toString(16)));
        return 0;
      },

      b(addr) {
        switch(addr>>>24) {
          case 0x00: // Base
          case 0x80: // Mirror
            return pseudo.CstrMem._ram.ub[(( addr)&(pseudo.CstrMem._ram.ub.byteLength-1))>>>0];

          case 0xbf: // BIOS
            return pseudo.CstrMem._rom.ub[(( addr)&(pseudo.CstrMem._rom.ub.byteLength-1))>>>0];
        }

        if (addr === 0x1f000084) { // PIO?
          return 0;
        }
        pseudo.CstrMain.error('Mem Read b '+('0x'+(addr>>>0).toString(16)));
        return 0;
      }
    },

    executeDMA: function(addr) {
      if (!pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] || pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|8)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2] !== 0x11000002) {
        return;
      }
      pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&=0xffffff;

      while(--pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]) {
        pseudo.CstrMem._ram.uw[(( pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2])&(pseudo.CstrMem._ram.uw.byteLength-1))>>>2] = (pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]-4)&0xffffff;
        pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]-=4;
      }
      pseudo.CstrMem._ram.uw[(( pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|0)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2])&(pseudo.CstrMem._ram.uw.byteLength-1))>>>2] = 0xffffff;
    }
  };
})();








// Inline functions for speedup



























pseudo.CstrR3ka = (function() {
  let r, copr; // Base + Coprocessor
  let opcodeCount;
  let cacheAddr, power32; // Cache for expensive calculation
  let output;

  const mask = [
    [0x00ffffff, 0x0000ffff, 0x000000ff, 0x00000000],
    [0x00000000, 0xff000000, 0xffff0000, 0xffffff00],
    [0xffffff00, 0xffff0000, 0xff000000, 0x00000000],
    [0x00000000, 0x000000ff, 0x0000ffff, 0x00ffffff],
  ];

  const shift = [
    [0x18, 0x10, 0x08, 0x00],
    [0x00, 0x08, 0x10, 0x18],
    [0x18, 0x10, 0x08, 0x00],
    [0x00, 0x08, 0x10, 0x18],
  ];

  // Base CPU stepper
  function step(inslot) {
    const code = r[32]>>>20 === 0xbfc ? pseudo.CstrMem._rom.uw[(( r[32])&(pseudo.CstrMem._rom.uw.byteLength-1))>>>2] : pseudo.CstrMem._ram.uw[(( r[32])&(pseudo.CstrMem._ram.uw.byteLength-1))>>>2];
    opcodeCount++;
    r[32]  += 4;
    r[0] = 0; // As weird as this seems, it is needed

    switch(((code>>>26)&0x3f)) {
      case 0: // SPECIAL
        switch(code&0x3f) {
          case 0: // SLL
            r[((code>>>11)&0x1f)] = r[((code>>>16)&0x1f)] << ((code>>>6)&0x1f);
            return;

          case 2: // SRL
            r[((code>>>11)&0x1f)] = r[((code>>>16)&0x1f)] >>> ((code>>>6)&0x1f);
            return;

          case 3: // SRA
            r[((code>>>11)&0x1f)] = ((r[((code>>>16)&0x1f)])<<0>>0) >> ((code>>>6)&0x1f);
            return;

          case 4: // SLLV
            r[((code>>>11)&0x1f)] = r[((code>>>16)&0x1f)] << (r[((code>>>21)&0x1f)]&0x1f);
            return;

          case 6: // SRLV
            r[((code>>>11)&0x1f)] = r[((code>>>16)&0x1f)] >>> (r[((code>>>21)&0x1f)]&0x1f);
            return;

          case 7: // SRAV
            r[((code>>>11)&0x1f)] = ((r[((code>>>16)&0x1f)])<<0>>0) >> (r[((code>>>21)&0x1f)]&0x1f);
            return;

          case 8: // JR
            branch(r[((code>>>21)&0x1f)]);
            if (r[32] === 0xb0) { if (r[9] === 59 || r[9] === 61) { const char = String.fromCharCode(r[4]&0xff).replace(/\n/, '<br/>'); output.append(char.toUpperCase()); } };
            return;

          case 9: // JALR
            r[((code>>>11)&0x1f)] = r[32]+4;
            branch(r[((code>>>21)&0x1f)]);
            return;

          case 12: // SYSCALL
            r[32]-=4;
            copr[12] = (copr[12]&0xffffffc0)|((copr[12]<<2)&0x3f); copr[13] = 0x20; copr[14] = r[32]; r[32] = 0x80;
            return;

          case 16: // MFHI
            r[((code>>>11)&0x1f)] = r[34];
            return;

          case 17: // MTHI
            r[34] = r[((code>>>21)&0x1f)];
            return;

          case 18: // MFLO
            r[((code>>>11)&0x1f)] = r[33];
            return;

          case 19: // MTLO
            r[33] = r[((code>>>21)&0x1f)];
            return;

          case 25: // MULTU
            cacheAddr = r[((code>>>21)&0x1f)] *  r[((code>>>16)&0x1f)]; r[33] = cacheAddr&0xffffffff; r[34] = (cacheAddr/power32) | 0;
            return;

          case 26: // DIV
            if ( ((r[((code>>>16)&0x1f)])<<0>>0)) { r[33] = ((r[((code>>>21)&0x1f)])<<0>>0) /  ((r[((code>>>16)&0x1f)])<<0>>0); r[34] = ((r[((code>>>21)&0x1f)])<<0>>0) %  ((r[((code>>>16)&0x1f)])<<0>>0); };
            return;

          case 27: // DIVU
            if ( r[((code>>>16)&0x1f)]) { r[33] = r[((code>>>21)&0x1f)] /  r[((code>>>16)&0x1f)]; r[34] = r[((code>>>21)&0x1f)] %  r[((code>>>16)&0x1f)]; };
            return;

          case 32: // ADD
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] + r[((code>>>16)&0x1f)];
            return;

          case 33: // ADDU
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] + r[((code>>>16)&0x1f)];
            return;

          case 35: // SUBU
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] - r[((code>>>16)&0x1f)];
            return;

          case 36: // AND
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] & r[((code>>>16)&0x1f)];
            return;

          case 37: // OR
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] | r[((code>>>16)&0x1f)];
            return;

          case 38: // XOR
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] ^ r[((code>>>16)&0x1f)];
            return;

          case 39: // NOR
            r[((code>>>11)&0x1f)] = ~(r[((code>>>21)&0x1f)] | r[((code>>>16)&0x1f)]);
            return;

          case 42: // SLT
            r[((code>>>11)&0x1f)] = ((r[((code>>>21)&0x1f)])<<0>>0) < ((r[((code>>>16)&0x1f)])<<0>>0);
            return;

          case 43: // SLTU
            r[((code>>>11)&0x1f)] = r[((code>>>21)&0x1f)] < r[((code>>>16)&0x1f)];
            return;
        }
        pseudo.CstrMain.error('Special CPU instruction '+(code&0x3f));
        return;

      case 1: // REGIMM
        switch (((code>>>16)&0x1f)) {
          case 0: // BLTZ
            if (((r[((code>>>21)&0x1f)])<<0>>0) < 0) {
              branch((r[32]+((((code)<<16>>16))<<2)));
            }
            return;

          case 1: // BGEZ
            if (((r[((code>>>21)&0x1f)])<<0>>0) >= 0) {
              branch((r[32]+((((code)<<16>>16))<<2)));
            }
            return;
        }
        pseudo.CstrMain.error('Bcond CPU instruction '+((code>>>16)&0x1f));
        return;

      case 2: // J
        branch(((r[32]&0xf0000000)|(code&0x3ffffff)<<2));
        return;

      case 3: // JAL
        r[31] = r[32]+4;
        branch(((r[32]&0xf0000000)|(code&0x3ffffff)<<2));
        return;

      case 4: // BEQ
        if (r[((code>>>21)&0x1f)] === r[((code>>>16)&0x1f)]) {
          branch((r[32]+((((code)<<16>>16))<<2)));
        }
        return;

      case 5: // BNE
        if (r[((code>>>21)&0x1f)] !== r[((code>>>16)&0x1f)]) {
          branch((r[32]+((((code)<<16>>16))<<2)));
        }
        return;

      case 6: // BLEZ
        if (((r[((code>>>21)&0x1f)])<<0>>0) <= 0) {
          branch((r[32]+((((code)<<16>>16))<<2)));
        }
        return;

      case 7: // BGTZ
        if (((r[((code>>>21)&0x1f)])<<0>>0) > 0) {
          branch((r[32]+((((code)<<16>>16))<<2)));
        }
        return;

      case 8: // ADDI
        r[((code>>>16)&0x1f)] = r[((code>>>21)&0x1f)] + (((code)<<16>>16));
        return;

      case 9: // ADDIU
        r[((code>>>16)&0x1f)] = r[((code>>>21)&0x1f)] + (((code)<<16>>16));
        return;

      case 10: // SLTI
        r[((code>>>16)&0x1f)] = ((r[((code>>>21)&0x1f)])<<0>>0) < (((code)<<16>>16));
        return;

      case 11: // SLTIU
        r[((code>>>16)&0x1f)] = r[((code>>>21)&0x1f)] < (code&0xffff);
        return;

      case 12: // ANDI
        r[((code>>>16)&0x1f)] = r[((code>>>21)&0x1f)] & (code&0xffff);
        return;

      case 13: // ORI
        r[((code>>>16)&0x1f)] = r[((code>>>21)&0x1f)] | (code&0xffff);
        return;

      case 15: // LUI
        r[((code>>>16)&0x1f)] = code<<16;
        return;

      case 16: // COP0
        switch (((code>>>21)&0x1f)) {
          case 0: // MFC0
            r[((code>>>16)&0x1f)] = copr[((code>>>11)&0x1f)];
            return;

          case 4: // MTC0
            copr[((code>>>11)&0x1f)] = r[((code>>>16)&0x1f)];
            return;

          case 16: // RFE
            copr[12] = (copr[12]&0xfffffff0)|((copr[12]>>>2)&0xf);
            return;
        }
        pseudo.CstrMain.error('Coprocessor 0 instruction '+((code>>>21)&0x1f));
        return;

      case 32: // LB
        r[((code>>>16)&0x1f)] = ((pseudo.CstrMem.read.b((r[((code>>>21)&0x1f)]+(((code)<<16>>16)))))<<24>>24);
        return;

      case 33: // LH
        r[((code>>>16)&0x1f)] = ((pseudo.CstrMem.read.h((r[((code>>>21)&0x1f)]+(((code)<<16>>16)))))<<16>>16);
        return;

      case 34: // LWL
        cacheAddr = (r[((code>>>21)&0x1f)]+(((code)<<16>>16)));
        r[((code>>>16)&0x1f)] = (r[((code>>>16)&0x1f)]&mask[0][cacheAddr&3]) | (pseudo.CstrMem.read.w(cacheAddr&~3)<<shift[0][cacheAddr&3]);
        return;

      case 35: // LW
        r[((code>>>16)&0x1f)] = pseudo.CstrMem.read.w((r[((code>>>21)&0x1f)]+(((code)<<16>>16))));
        return;

      case 36: // LBU
        r[((code>>>16)&0x1f)] = pseudo.CstrMem.read.b((r[((code>>>21)&0x1f)]+(((code)<<16>>16))));
        return;

      case 37: // LHU
        r[((code>>>16)&0x1f)] = pseudo.CstrMem.read.h((r[((code>>>21)&0x1f)]+(((code)<<16>>16))));
        return;

      case 38: // LWR
        cacheAddr = (r[((code>>>21)&0x1f)]+(((code)<<16>>16)));
        r[((code>>>16)&0x1f)] = (r[((code>>>16)&0x1f)]&mask[1][cacheAddr&3]) | (pseudo.CstrMem.read.w(cacheAddr&~3)>>shift[1][cacheAddr&3]);
        return;

      case 40: // SB
        pseudo.CstrMem.write.b((r[((code>>>21)&0x1f)]+(((code)<<16>>16))), r[((code>>>16)&0x1f)]);
        return;

      case 41: // SH
        pseudo.CstrMem.write.h((r[((code>>>21)&0x1f)]+(((code)<<16>>16))), r[((code>>>16)&0x1f)]);
        return;

      case 42: // SWL
        cacheAddr = (r[((code>>>21)&0x1f)]+(((code)<<16>>16)));
        pseudo.CstrMem.write.w(cacheAddr&~3, (r[((code>>>16)&0x1f)]>>shift[2][cacheAddr&3]) | (pseudo.CstrMem.read.w(cacheAddr&~3)&mask[2][cacheAddr&3]));
        return;

      case 43: // SW
        pseudo.CstrMem.write.w((r[((code>>>21)&0x1f)]+(((code)<<16>>16))), r[((code>>>16)&0x1f)]);
        return;

      case 46: // SWR
        cacheAddr = (r[((code>>>21)&0x1f)]+(((code)<<16>>16)));
        pseudo.CstrMem.write.w(cacheAddr&~3, (r[((code>>>16)&0x1f)]<<shift[3][cacheAddr&3]) | (pseudo.CstrMem.read.w(cacheAddr&~3)&mask[3][cacheAddr&3]));
        return;
    }
    pseudo.CstrMain.error('Basic CPU instruction '+((code>>>26)&0x3f));
  }

  function branch(addr) {
    // Execute instruction in slot
    step(true);
    r[32] = addr;

    // Rootcounters, interrupts
    pseudo.CstrCounters.update();
    pseudo.CstrBus.interruptsUpdate();

    // Exceptions
    if (pseudo.CstrMem._hwr.uw[((0x1070)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&pseudo.CstrMem._hwr.uw[((0x1074)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]) {
      if ((copr[12]&0x401) === 0x401) {
        copr[12] = (copr[12]&0xffffffc0)|((copr[12]<<2)&0x3f); copr[13] = 0x400; copr[14] = r[32]; r[32] = 0x80;
      }
    }
  }

  // Exposed class functions/variables
  return {
    awake(element) {
         r = new Uint32Array(32 + 3); // + r[32], r[33], r[34]
      copr = new Uint32Array(16);

      // Cache
      power32 = Math.pow(32, 2); // Btw, pure multiplication is faster
      output  = element;
    },

    reset() {
         r.fill(0);
      copr.fill(0);

      copr[12] = 0x10900000;
      copr[15] = 0x2;

      r[32] = 0xbfc00000;
      opcodeCount = 0;

      // Clear console out
      output.text(' ');

      // Bootstrap
      pseudo.CstrR3ka.consoleWrite('BIOS file has been written to ROM', false);
      const start = performance.now();

      while (r[32] !== 0x80030000) {
        step(false);
      }
      const delta = parseFloat(performance.now()-start).toFixed(2);
      pseudo.CstrR3ka.consoleWrite('Bootstrap completed in '+delta+' ms', true);
    },

    run() {
      for (let i=0; i<350000; i++) {
        step(false);
      }
      requestAnimationFrame(pseudo.CstrR3ka.run);
    },

    exeHeader(hdr) {
      r[32]    = hdr[2+ 2];
      r[28] = hdr[2+ 3];
      r[29] = hdr[2+10];
    },

    writeOK() {
      return !(copr[12]&0x10000);
    },

    consoleWrite(out, space) {
      output.append((space ? '<br/>' : ' ')+'<div class="pseudoText">PSeudo / '+out+'</div>'+(space ? '<br/>' : ' '));
    }
  };
})();







pseudo.CstrMain = (function() {
  // Generic function for file read
  function file(path, fn) {
    const xhr = new XMLHttpRequest();
    xhr.onload = function() {
      fn(xhr.response);
    };
    xhr.responseType = 'arraybuffer';
    xhr.open('GET', path);
    xhr.send();
  }

  // Exposed class functions/variables
  return {
    awake() {
      $(function() { // DOMContentLoaded
        pseudo.CstrGraphics     .awake($('#screen'));
        pseudo.CstrCounters.awake();
        pseudo.CstrR3ka   .awake($('#output'));

        file('bios/scph1001.bin', function(resp) {
          // Move BIOS to Mem
          pseudo.CstrMem._rom.ub.set(new Uint8Array(resp));
        });
      });
    },

    reset(path) {
      // Reset all emulator components
      pseudo.CstrGraphics     .reset();
      pseudo.CstrMem    .reset();
      pseudo.CstrCounters.reset();
      pseudo.CstrBus    .reset();
      pseudo.CstrR3ka   .reset();

      if (path === 'bios') { // BIOS run
        pseudo.CstrR3ka.run();
      }
      else { // Homebrew run
        file(path, function(resp) {
          const header = new Uint32Array(resp, 0, 0x800);
          const exe    = new Uint8Array(resp, 0x800);
          const offset = header[2+4];
          const size   = header[2+5];

          // Prepare pseudo.CstrMem
          pseudo.CstrMem._ram.ub.set(exe.slice(0, size), offset&(pseudo.CstrMem._ram.ub.byteLength-1)); // Offset needs boundaries... huh?
          
          // Prepare processor
          pseudo.CstrR3ka.exeHeader(header);
          pseudo.CstrR3ka.run();
        });
      }
    },

    error(out) {
      throw new Error('PSeudo / '+out);
    }
  };
})();














pseudo.CstrGraphics = (function() {
  let status;
  let pipe;
  let modeDMA;
  let screen;

  const resMode = [
    256, 320, 512, 640, 368, 384, 512, 640
  ];

  const sizePrim = [
    0, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x00
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x10
    4, 4, 4, 4, 7, 7, 7, 7, 5, 5, 5, 5, 9, 9, 9, 9, // 0x20
    6, 6, 6, 6, 9, 9, 9, 9, 8, 8, 8, 8,12,12,12,12, // 0x30
    3, 3, 3, 3, 0, 0, 0, 0, 5, 5, 5, 5, 6, 6, 6, 6, // 0x40
    4, 4, 4, 4, 0, 0, 0, 0, 7, 7, 7, 7, 9, 9, 9, 9, // 0x50
    3, 3, 3, 3, 4, 4, 4, 4, 2, 2, 2, 2, 0, 0, 0, 0, // 0x60
    2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 3, 3, 3, 3, // 0x70
    4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x80
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x90
    3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xa0
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xb0
    3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xc0
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xd0
    0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xe0
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0xf0
  ];

  const write = {
    data(addr) {
      if (!pipe.size) {
        const prim = (addr>>>24)&0xff;
        const size = sizePrim[prim];

        if (size) {
          pipe.data[0] = addr;
          pipe.prim = prim;
          pipe.size = size;
          pipe.row  = 1;
        }
        else {
          return;
        }
      }
      else {
        pipe.data[pipe.row] = addr;
        pipe.row++;
      }

      // Render primitive
      if (pipe.size === pipe.row) {
        pipe.size = 0;
        pipe.row  = 0;
        
        console.dir('GPU Render Primitive '+('0x'+(pipe.prim>>>0).toString(16)));
      }
    }
  }

  function resize(res) {
    if (res.h > 0 && res.v > 0) {
      screen.width = res.h;
      screen.hei   = res.v;
    
      $('#resolution').text(res.h+' x '+res.v);
    }
  }

  // Exposed class functions/variables
  return {
    awake(element) {
      // Command Pipe
      pipe = {
        data: new Uint32Array(100)
      };

      // Canvas
      screen = element;
    },

    reset() {
      status  = 0x14802000;
      modeDMA = 0;

      // Command Pipe
      pipe.data.fill(0);
      pipe.prim = 0;
      pipe.size = 0;
      pipe.row  = 0;
    },

    scopeW(addr, data) {
      switch(addr&0xf) {
        case 0:
          write.data(data);
          return;

        case 4:
          switch((data>>>24)&0xff) {
            case 0x00:
              status = 0x14802000;
              return;

            case 0x03:
              return;

            case 0x04:
              modeDMA = data&3;
              return;

            case 0x08:
              resize({
                h: resMode[(data&3)|((data&0x40)>>>4)],
                v: (data&4) ? 480 : 240
              });
              return;

            
            case 0x05:
            case 0x06:
            case 0x07:
              return;
          }
          pseudo.CstrMain.error('GPU Write Status '+('0x'+((addr>>>24)&0xff>>>0).toString(16)));
          return;
      }
    },

    scopeR(addr) {
      switch(addr&0xf) {
        case 0:
          return 0; // Nope: data

        case 4:
          return status;
      }
    },

    executeDMA(addr) {
      var size = (pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]>>16)*(pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|4)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]&0xffff);

      switch (pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|8)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]) {
        case 0x00000401: // Disable DMA?
          return;

        case 0x01000201:
          return;

        case 0x01000401:
          return;
      }
      pseudo.CstrMain.error('GPU DMA '+('0x'+(pseudo.CstrMem._hwr.uw[(((addr&0xfff0)|8)&(pseudo.CstrMem._hwr.uw.byteLength-1))>>>2]>>>0).toString(16)));
    }
  };
})();

