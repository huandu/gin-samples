#!/usr/bin/python
# vim: fileencoding=utf-8:
from bms import BMS

import sys, getopt, json

def usage():
    """print usage"""
    print """Usage: 
    -d:
        debug
    -f:
        output beat
    -i, --input:
        input file path
    -o, --output:
        output file path
    -h, --help:
        print this help
    """
    pass

def main(argv):

    _debug = False
    _input = _output = ''
    _frame = False
    try:
        opts, args = getopt.getopt(argv, 'hi:o:fd', ['help', 'input=', 'output='])
    except getopt.GetoptError:
        usage()
        sys.exit(2)

    for opt, arg in opts:
        if opt in ('-h', '--help'):
            usage()
            sys.exit()
        elif opt in ('-d'):
            _debug = True
        elif opt in ('-i', '--input'):
            _input = arg
        elif opt in ('-o', '--output'):
            _output = arg
        elif opt in ('-f', '--fps'):
            _frame = True 


    bms = BMS().parse(_input)
    body = bms.body

    output = {
        'header': bms.header,
        'define': bms.define,
        'body': bms.body,
        'length': len(bms.body)
    }
    if _frame > 0:
        frames = {}
        for noteId in body:
            
            note = body[noteId]
            frames[ int(noteId) ] = {}
            divide = {}
            for pos in note:
                if (len(note[pos]) > len(divide)):
                    divide = note[pos]
            for offset in divide:
                if _debug:
                    print (noteId, bms.header["DIVIDE"], offset, bms.header["BPM"])
                theFrame = {}
                for pos in note:
                    if offset in note[pos]:
                        val = int(note[pos][offset])
                        if val:
                            theFrame[pos] = val
                if (len(theFrame)):
                    frames[int(noteId)][offset] = theFrame

        output["frames"] = frames
    
    if _debug:
        print output["frames"] 
        print bms.header 

    o = open(_output, 'w')
    o.write("var bms = " + json.dumps(output))
    o.close()

if __name__ == '__main__':
    main(sys.argv[1:])
