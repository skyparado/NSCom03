# Figures for the report, built from the numbers in findings.md (5 stations, mean over 10 seeds).
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'serif','font.size':8})
d=list(range(10,101,10))
loss={'16 dBm':[100,72,17,0.2,0,0,0,0,0,0],'23 dBm':[100,100,89,44,15,0.3,0.1,0,0,0],'30 dBm':[100,100,100,99.8,99.7,74,45,21,1.0,0.7]}
fig,ax=plt.subplots(figsize=(3.4,2.2))
for (k,v),c in zip(loss.items(),['#E0A100','#D9622B','#9B1C1C']): ax.plot(d,v,'o-',ms=3,label=k+' jammer',color=c)
ax.axhline(50,ls=':',c='gray',lw=.8); ax.set_xlabel('Jammer distance from AP (m)'); ax.set_ylabel('Packet loss (%)')
ax.legend(frameon=False); ax.set_xticks(d); fig.tight_layout(); fig.savefig('fig1.png',dpi=300)
fig,ax=plt.subplots(figsize=(3.4,2.2)); import numpy as np
lab=['None','Ch. 3','Rate adapt.']; v5=[68,55,43]; v10=[76,61,83]; x=np.arange(3)
b1=ax.bar(x-.18,v5,.36,label='5 stations',color='#1F5F8B'); b2=ax.bar(x+.18,v10,.36,label='10 stations',color='#8FB8DE')
ax.bar_label(b1,fontsize=7); ax.bar_label(b2,fontsize=7); ax.set_xticks(x,lab); ax.set_ylabel('Denial radius (m)'); ax.set_ylim(0,110)
ax.legend(frameon=False,loc='upper center',ncol=2)
fig.tight_layout(); fig.savefig('fig2.png',dpi=300)
