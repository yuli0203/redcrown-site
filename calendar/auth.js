(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const dialog = $('#auth-dialog');
  const authSurface = dialog || $('.entry-card');
  const emailPanel = $('#auth-email-panel');
  function showAuth() {
    if (auth?.currentUser?.emailVerified && $('#sync-availability')) { $('#sync-availability').scrollIntoView({block:'start'}); return; }
    if (dialog) dialog.showModal();
    else authSurface.scrollIntoView({block:'center'});
  }
  function closeAuth() {
    if (dialog) dialog.close();
    if (emailPanel) { emailPanel.hidden = true; $('#main-signin').setAttribute('aria-expanded','false'); }
    $('#auth-password').value = '';
  }
  const form = $('#auth-form');
  let sdk, auth, ready = false, busy = false, creating = false, lastVerificationSent = 0;
  const verificationPanel = document.createElement('section');
  verificationPanel.hidden = true;
  verificationPanel.innerHTML = '<h3>Verify your email</h3><p>Open the verification link in your inbox, then return here. Check your spam folder too.</p><button type="button" data-auth-action id="auth-check-verification">I have verified my email</button><button type="button" data-auth-action id="auth-resend-verification">Resend verification email</button>';
  authSurface.append(verificationPanel);
  async function sendVerification(user) {
    if (Date.now() - lastVerificationSent < 60000) { message('Please wait a minute before requesting another verification email.'); return; }
    await sdk.sendEmailVerification(user, {url: location.origin + '/calendar/'});
    lastVerificationSent = Date.now();
    message('Verification email sent. Open the link, then select I have verified my email.');
  }
  async function checkVerification() {
    if (!auth.currentUser) return;
    await sdk.reload(auth.currentUser);
    await auth.currentUser.getIdToken(true);
    renderUser(auth.currentUser);
    message(auth.currentUser.emailVerified ? 'Your email is verified. Welcome!' : 'Your email is not verified yet. Open the link in your inbox first.');
  }
  $('#auth-check-verification').addEventListener('click', () => run(checkVerification));
  $('#auth-resend-verification').addEventListener('click', () => run(() => sendVerification(auth.currentUser)));
  window.CrownAuth={token:()=>auth?.currentUser?.getIdToken(),current:()=>auth?.currentUser};
  let microsoftEnabled = false;
  let unavailable = 'Loading sign-in...';
  const message = text => { $('#auth-message').textContent = text; if ($('#workspace-auth-status')) $('#workspace-auth-status').textContent = text; };
  const updateControls = () => {
    authSurface.querySelectorAll('[data-auth-action], input').forEach(control => { control.disabled = !ready || busy; });
    $('#auth-google').disabled = busy;
    $('#auth-microsoft').disabled = busy;
    $('#auth-signout').disabled = busy;
  };
  const errors = {
    'auth/invalid-credential': 'Unable to sign in. Check your email and password.',
    'auth/user-not-found': 'Unable to sign in. Check your email and password.',
    'auth/wrong-password': 'Unable to sign in. Check your email and password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'Unable to create this account. Try signing in or resetting your password.',
    'auth/weak-password': 'Use a stronger password that meets the account password policy.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet the account password policy.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Connection failed. Check your internet connection and try again.',
    'auth/popup-blocked': 'Allow the sign-in popup in your browser, or use email and password.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. You can try again.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open.',
    'auth/unauthorized-domain': 'Sign-in is not enabled for this website address yet.',
    'auth/operation-not-allowed': 'This sign-in method has not been enabled yet.',
    'auth/account-exists-with-different-credential': 'Use the sign-in method you originally used for this email.',
    'auth/user-disabled': 'This account is unavailable.',
    'auth/web-storage-unsupported': 'Allow browser storage to use sign-in.'
  };
  async function run(action) {
    if (busy) return;
    if (!ready) { message(unavailable); return; }
    busy = true; message('Please wait...'); updateControls();
    try { await action(); }
    catch (error) { message(errors[error.code] || 'Unable to complete sign-in. Please try again.'); }
    finally { busy = false; updateControls(); }
  }
  function setMode(register) {
    creating = register;
    $('#auth-title').textContent = register ? 'Create your account' : 'Sign in to Red Crown Calendar';
    $('#auth-submit').textContent = register ? 'Create account' : 'Sign in';
    $('#auth-switch').textContent = register ? 'Already have an account? Sign in' : 'New here? Create an account';
    $('#auth-password').autocomplete = register ? 'new-password' : 'current-password';
    $('#auth-password').minLength = register ? 8 : 1;
    $('#auth-password').value = '';
    $('#auth-password-help').hidden = !register;
    message(ready ? '' : unavailable);
  }
  $('#auth-open')?.addEventListener('click', () => { showAuth(); $('#auth-google').focus({preventScroll:true}); });
  $('.footer-signin')?.addEventListener('click', () => { showAuth(); $('#auth-google').focus({preventScroll:true}); });
  $('#main-signin')?.addEventListener('click', () => {
    if (auth?.currentUser) { if (!auth.currentUser.emailVerified) { verificationPanel.scrollIntoView({block:'center'}); return; } location.assign('/calendar/preview/'); return; }
    if (emailPanel) {
      const opening = emailPanel.hidden;
      emailPanel.hidden = !opening;
      $('#main-signin').setAttribute('aria-expanded',String(opening));
      if (opening) { setMode(false); if (ready) $('#auth-email').focus({preventScroll:true}); }
      else $('#auth-password').value = '';
    } else { setMode(false); showAuth(); }
  });
  $('#auth-close')?.addEventListener('click', closeAuth);
  dialog?.addEventListener('close', () => { $('#auth-password').value = ''; });
  $('#auth-switch').addEventListener('click', () => setMode(!creating));
  $('#auth-google').addEventListener('click', () => run(async () => {
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await sdk.signInWithPopup(auth, provider);
    closeAuth();
  }));
  $('#auth-microsoft').addEventListener('click', () => run(async () => {
    if (!microsoftEnabled) {
      message('Microsoft sign-in is not connected yet. Please use Google or email.');
      return;
    }
    const provider = new sdk.OAuthProvider('microsoft.com');
    provider.setCustomParameters({prompt:'select_account', tenant:'common'});
    // Identity only. Calendar permissions require a separate connection flow.
    await sdk.signInWithPopup(auth, provider);
    closeAuth();
  }));
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    run(async () => {
      if (creating) {
        const policy = await sdk.validatePassword(auth, password);
        if (!policy.isValid) { message('Choose a stronger password: check the minimum length, uppercase, lowercase, number and symbol requirements.'); return; }
        const credential = await sdk.createUserWithEmailAndPassword(auth, email, password);
        $('#auth-password').value = '';
        try { await sendVerification(credential.user); message('Account created. Check your email to verify your address.'); }
        catch { message('Account created, but the verification email could not be sent. Use Verify email to try again.'); }
      } else {
        await sdk.signInWithEmailAndPassword(auth, email, password);
        closeAuth();
      }
    });
  });
  $('#auth-reset').addEventListener('click', () => {
    const emailInput = $('#auth-email');
    if (!emailInput.reportValidity()) return;
    run(async () => {
      try { await sdk.sendPasswordResetEmail(auth, emailInput.value.trim()); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      message('If this address can receive a reset email, you will receive instructions shortly.');
    });
  });
  $('#auth-signout').addEventListener('click', () => run(async () => {
    await sdk.signOut(auth); message('Signed out.');
  }).then(() => { if (auth?.currentUser) showAuth(); }));
  $('#auth-verify').addEventListener('click', () => {
    showAuth();
    run(async () => {
      await checkVerification();
    });
  });
  function renderUser(user) {
    const verified = Boolean(user?.emailVerified);
    verificationPanel.hidden = !user || verified;
    if ($('.footer-signin')) $('.footer-signin').textContent = user ? 'Calendar workspace' : 'Sign in / Create account';
    if ($('#auth-open')) $('#auth-open').hidden = Boolean(user);
    $('#auth-account').hidden = !user;
    $('#auth-identity').textContent = user?.displayName || user?.email || 'Your account';
    $('#auth-identity').title = user?.email || '';
    $('#auth-verify').hidden = !user || user.emailVerified;
    if ($('#account-storage-note')) $('#account-storage-note').textContent = user
      ? 'Saved locally for this account, on this browser only. Sign-in does not sync meetings across devices.'
      : 'Guest meetings are stored in this browser. Sign in to use a separate local meeting list.';
    if ($('#main-signin')) $('#main-signin').textContent = user ? (verified ? 'Open calendar preview' : 'Verify your email to continue') : 'Sign in with email';
    if (!dialog) {
      $('#auth-google').hidden = Boolean(user);
      $('#auth-microsoft').hidden = Boolean(user);
      if (user) { emailPanel.hidden = true; $('#main-signin').setAttribute('aria-expanded','false'); }
    }
    if ($('#signin-availability')) $('#signin-availability').textContent = user ? (verified ? 'Signed in with a verified email.' : 'Verify your email before connecting calendars or setting up bookings.') : (microsoftEnabled ? 'Google, Microsoft or email. No credit card required.' : 'Google or email. Microsoft sign-in is coming soon. No credit card required.');
    // Only verified identities unlock the workspace. The API independently enforces verification.
    document.dispatchEvent(new CustomEvent('crown-auth-change', {detail:{uid:verified ? user.uid : null,displayName:user?.displayName || '',email:user?.email || ''}}));
  }
  async function initialize() {
    updateControls();
    try {
      const response = await fetch('/calendar/auth-config.json', {cache:'no-store'});
      if (!response.ok) throw new Error('config');
      const {firebase, providers} = await response.json();
      microsoftEnabled = providers?.microsoft === true;
      if (!firebase || !['apiKey','authDomain','projectId','appId'].every(key => typeof firebase[key] === 'string' && firebase[key].trim())) {
        unavailable = 'Sign-in is not activated yet. The site owner needs to connect the Firebase project. You can still use the local calendar.';
        if ($('#signin-availability')) $('#signin-availability').textContent = 'Account registration opens once sign-in setup is complete. You can explore the preview now.';
        message(unavailable); return;
      }
      const [appSDK, authSDK] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
      ]);
      sdk = authSDK;
      auth = sdk.getAuth(appSDK.initializeApp(firebase));
      // Do not persist sessions indefinitely on shared computers.
      await sdk.setPersistence(auth, sdk.browserSessionPersistence);
      await auth.authStateReady();
      await window.CrownAPI?.ready;
      sdk.onAuthStateChanged(auth, renderUser);
      ready = true; message(''); updateControls();
    } catch {
      unavailable = 'Sign-in could not load. Check your connection and reload the page. The local calendar is still available.';
      if ($('#signin-availability')) $('#signin-availability').textContent = unavailable;
      message(unavailable);
    }
  }
  initialize();
})();
