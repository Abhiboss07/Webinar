import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const label = (s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Roles() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);   // selected role _id
  const [perms, setPerms] = useState({});
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => api.roles().then((r) => {
    setData(r);
    setSel((cur) => cur || (r.roles[0] && r.roles[0]._id));
  }).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { load(); }, [load]);

  const role = data?.roles.find((r) => r._id === sel);
  useEffect(() => { if (role) { setPerms(JSON.parse(JSON.stringify(role.permissions || {}))); setDirty(false); } }, [sel, data]); // eslint-disable-line

  if (!data) return <Layout title="Roles & Permissions"><div className="notice">Loading…</div></Layout>;

  const has = (res, act) => role?.isSuperAdmin || !!(perms[res] && perms[res][act]);
  const toggle = (res, act) => {
    if (role?.isSuperAdmin) return;
    setPerms((p) => {
      const n = { ...p, [res]: { ...(p[res] || {}) } };
      if (n[res][act]) delete n[res][act]; else n[res][act] = true;
      if (Object.keys(n[res]).length === 0) delete n[res];
      return n;
    });
    setDirty(true);
  };
  const save = async () => {
    try { await api.roleUpdate(role._id, { permissions: perms }); toast("Permissions saved", "success"); await load(); }
    catch (e) { toast(e.message, "error"); }
  };
  const createRole = async () => {
    const name = window.prompt("New role name:"); if (!name) return;
    try { const r = await api.roleCreate({ name, key: name.toLowerCase().replace(/\s+/g, "_") }); toast("Role created", "success"); await load(); setSel(r.role._id); }
    catch (e) { toast(e.message, "error"); }
  };
  const del = async () => {
    if (!window.confirm(`Delete role “${role.name}”?`)) return;
    try { await api.roleDelete(role._id); toast("Deleted", "info"); setSel(null); await load(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <Layout title="Roles & Permissions">
      <div className="roles-layout">
        <div className="roles-list">
          {data.roles.map((r) => (
            <button key={r._id} className={`role-item ${sel === r._id ? "active" : ""}`} onClick={() => setSel(r._id)}>
              <div style={{ fontWeight: 600 }}>{r.name} {r.isSuperAdmin && <span className="badge good" style={{ marginLeft: 4 }}>Super</span>}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{r.userCount} user(s){r.system ? " · system" : ""}</div>
            </button>
          ))}
          <button className="btn ghost" style={{ marginTop: 8, width: "100%" }} onClick={createRole}>+ New role</button>
        </div>

        <div className="panel" style={{ margin: 0, flex: 1 }}>
          <div className="panel-head">
            <div><h3>{role?.name}</h3><p>{role?.description || (role?.isSuperAdmin ? "Full access — cannot be edited." : "Toggle permissions, then save.")}</p></div>
            <div className="hstack">
              {!role?.system && <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={del}>Delete</button>}
              {!role?.isSuperAdmin && <button className="btn primary" disabled={!dirty} onClick={save}>Save</button>}
            </div>
          </div>
          <div className="panel-body" style={{ overflowX: "auto" }}>
            <table className="matrix">
              <thead><tr><th>Resource</th>{data.actions.map((a) => <th key={a}>{label(a)}</th>)}</tr></thead>
              <tbody>
                {data.resources.map((res) => (
                  <tr key={res}>
                    <td style={{ fontWeight: 600 }}>{label(res)}</td>
                    {data.actions.map((a) => (
                      <td key={a} style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={has(res, a)} disabled={role?.isSuperAdmin} onChange={() => toggle(res, a)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
