import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";

const when = (d) => (d ? new Date(d).toLocaleString() : "never");

function InviteDialog({ roles, onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState("viewer");
  const [token, setToken] = useState("");
  const submit = async () => {
    try { const r = await api.userInvite({ email, name, role }); toast("User invited", "success"); if (r.inviteToken) setToken(r.inviteToken); else onDone(); }
    catch (e) { toast(e.message, "error"); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><h3>Invite user</h3><button className="btn ghost icon" onClick={onClose}>✕</button></div>
      {token ? <>
        <div className="notice" style={{ wordBreak: "break-all" }}>Invite created. Since email isn't wired yet, share this one-time setup token with the user:<br /><b className="mono">{token}</b></div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={onDone}>Done</button>
      </> : <>
        <div className="field"><label>Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Role</label><select value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></div>
        <button className="btn primary" style={{ marginTop: 16 }} onClick={submit}>Send invite</button>
      </>}
    </div></div>
  );
}

function UserDrawer({ id, roles, onClose, onChanged }) {
  const toast = useToast();
  const { user: me, can } = useAuth();
  const [u, setU] = useState(null); const [sessions, setSessions] = useState([]); const [resetTok, setResetTok] = useState("");
  const load = () => api.userGet(id).then((r) => { setU(r.user); setSessions(r.sessions || []); }).catch((e) => toast(e.message, "error"));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!u) return <div className="drawer-backdrop" onClick={onClose}><div className="drawer"><div className="notice">Loading…</div></div></div>;
  const isSelf = me?.id === u.id;
  const upd = async (body, msg) => { try { const r = await api.userUpdate(id, body); setU(r.user); toast(msg || "Saved", "success"); onChanged && onChanged(); } catch (e) { toast(e.message, "error"); } };
  const reset = async () => { try { const r = await api.userReset(id); toast("Reset issued", "success"); if (r.resetToken) setResetTok(r.resetToken); } catch (e) { toast(e.message, "error"); } };
  const del = async () => { if (!window.confirm(`Delete ${u.email}?`)) return; try { await api.userDelete(id); toast("Deleted", "info"); onChanged && onChanged(); onClose(); } catch (e) { toast(e.message, "error"); } };

  return (
    <div className="drawer-backdrop" onClick={onClose}><div className="drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-head"><div><h3>{u.name}</h3><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></div><button className="btn ghost icon" onClick={onClose}>✕</button></div>
      <div className="drawer-body">
        <div className="drawer-sec">
          <div className="drawer-sec-t">Access</div>
          <div className="field"><label>Role</label>
            <select value={u.role} disabled={isSelf} onChange={(e) => upd({ role: e.target.value }, "Role updated")}>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select>
            {isSelf && <div className="desc">You can't change your own role.</div>}
          </div>
          <label className="flag" style={{ marginTop: 10 }}><input type="checkbox" checked={u.active} disabled={isSelf} onChange={(e) => upd({ active: e.target.checked }, e.target.checked ? "Activated" : "Deactivated")} /> Active</label>
        </div>
        <div className="drawer-sec">
          <div className="drawer-sec-t">Security</div>
          <div className="kv"><span>Last login</span><b>{when(u.lastLoginAt)}</b></div>
          <div className="kv"><span>Last IP</span><b>{u.lastLoginIp || "—"}</b></div>
          <div className="kv"><span>Locked</span><b>{u.locked ? "Yes" : "No"}</b></div>
          <div className="kv"><span>Must reset password</span><b>{u.mustResetPassword ? "Yes" : "No"}</b></div>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={reset}>Reset password</button>
          {resetTok && <div className="notice" style={{ marginTop: 8, wordBreak: "break-all" }}>Share this reset token: <b className="mono">{resetTok}</b></div>}
        </div>
        <div className="drawer-sec">
          <div className="drawer-sec-t">Active sessions ({sessions.length})</div>
          {sessions.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>No active sessions.</div> : sessions.map((s) => (
            <div className="hstack" key={s.id} style={{ fontSize: 12.5, padding: "5px 0" }}>
              <div style={{ minWidth: 0 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.userAgent || "Unknown device"}</div><div className="muted">{s.ip} · {when(s.lastUsedAt)}</div></div>
              <div className="spacer" /><button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => api.userRevokeSession(id, s.id).then(load)}>Revoke</button>
            </div>
          ))}
        </div>
        {can("users", "delete") && !isSelf && <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={del}>Delete user</button>}
      </div>
    </div></div>
  );
}

export default function Users() {
  const toast = useToast();
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [invite, setInvite] = useState(false);
  const [openId, setOpenId] = useState(null);
  const load = useCallback(() => api.users().then(setData).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { load(); }, [load]);
  const roles = data?.roles || [];
  const roleName = (k) => (roles.find((r) => r.key === k)?.name) || k;

  return (
    <Layout title="Users">
      <div className="hstack" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>{data ? `${data.users.length} user(s)` : ""}</div>
        <div className="spacer" />
        {can("users", "create") && <button className="btn primary" onClick={() => setInvite(true)}>+ Invite user</button>}
      </div>
      <div className="crm-table-wrap">
        <table className="crm-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead>
          <tbody>
            {!data ? Array.from({ length: 4 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((__, j) => <td key={j}><div className="skel" style={{ height: 12 }} /></td>)}</tr>) :
              data.users.map((u) => (
                <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(u.id)}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td><td className="muted">{u.email}</td>
                  <td><span className="badge" style={{ background: "var(--ring)", color: "var(--brand-ink)" }}>{roleName(u.role)}</span></td>
                  <td>{u.active ? <span className="pill Paid">Active</span> : <span className="pill Cancelled">Inactive</span>}{u.locked && <span className="pill Failed" style={{ marginLeft: 4 }}>Locked</span>}</td>
                  <td className="muted">{when(u.lastLoginAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {invite && <InviteDialog roles={roles} onClose={() => setInvite(false)} onDone={() => { setInvite(false); load(); }} />}
      {openId && <UserDrawer id={openId} roles={roles} onClose={() => setOpenId(null)} onChanged={load} />}
    </Layout>
  );
}
