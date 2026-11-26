import json,sys
def txt(inl):
    out=""
    for i in inl or []:
        t=i.get("type")
        if t=="text": out+=i["text"]
        elif t in("emphasis","strong","newTerm"): out+=txt(i.get("inlineContent"))
        elif t=="codeVoice": out+=i.get("code","")
        elif t=="reference": out+="["+i.get("identifier","").split("/")[-1]+"]"
    return out
def walk(c,d=0):
    for b in c or []:
        t=b.get("type")
        if t=="heading": print("\n"+"#"*b.get("level",2),b.get("text"))
        elif t=="paragraph": print(txt(b.get("inlineContent")))
        elif t in("unorderedList","orderedList"):
            for it in b["items"]: print("  "*d+"- ",end=""); walk(it.get("content"),d+1)
        elif t=="table":
            for r in b.get("rows",[]): print(" | ".join(" ".join(txt(x.get("inlineContent")) for x in cell) for cell in r))
        elif t=="aside": print("> ",end=""); walk(b.get("content"),d)
        elif t=="tabNavigator":
            for tab in b["tabs"]: print("[tab]",tab["title"]); walk(tab["content"],d)
        elif "content" in b: walk(b["content"],d)
j=json.load(open(sys.argv[1]))
print("ABSTRACT:",txt(j.get("abstract")))
for s in j.get("primaryContentSections",[]): walk(s.get("content"))
