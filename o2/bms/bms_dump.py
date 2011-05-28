#!/usr/bin/python
# vim: fileencoding=utf-8:
from bms import BMS

import sys, getopt, json

def usage():
    """print usage"""
    print """Usage: 
    -d:
        debug
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
    _fps = 0
    try:
        opts, args = getopt.getopt(argv, 'hi:o:f:d', ['help', 'input=', 'output='])
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
            _fps = int(arg)


    bms = BMS().parse(_input)
    body = bms.body

    output = {
        'header': bms.header,
        'define': bms.define,
        'body': bms.body,
        'length': len(bms.body)
    }
    if _fps > 0:
        frames = {}
        for noteId in body:
            note = body[noteId]
            divide = {}
            for pos in note:
                if (len(note[pos]) > len(divide)):
                    divide = note[pos]
            for offset in divide:
                if _debug:
                    print (noteId, bms.header["DIVIDE"], offset, bms.header["BPM"])
                frameId = int( 60.0*(int(noteId) * bms.header["DIVIDE"] + offset)*_fps / float(bms.header["BPM"])/ bms.header["DIVIDE"] )
                theFrame = {}
                for pos in note:
                    if offset in note[pos]:
                        val = int(note[pos][offset])
                        if val:
                            theFrame[pos] = val
                if (len(theFrame)):
                    frames[frameId] = theFrame

        output["frames"] = frames
    
    if _debug:
        print _fps
        print bms.header 

    o = open(_output, 'w')
    o.write("var bms = " + json.dumps(output))
    o.close()

if __name__ == '__main__':
    main(sys.argv[1:])
