(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const dialog = $('#auth-dialog');
  const form = $('#auth-form');
  let sdk, auth, ready = false, busy = false, creating = false;
  let unavailable = 'Loading sign-in...';
  const message = text => { $('#auth-message').textContent = text; };
  const updateControls = () => {
    dialog.querySelectorAll('[data-auth-action], input').forEach(control => { control.disabled = !ready || busy; });
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
    if (!ready || busy) return;
    busy = true; message('Please wait...'); updateControls();
    try { await action(); }
    catch (error) { message(errors[error.code] || 'Unable to complete sign-in. Please try again.'); }
    finally { busy = false; updateControls(); }
  }
  function setMode(register) {
    creating = register;
    $('#auth-title').textContent = register ? 'Create your account' : 'Sign in to Crown Calendar';
    $('#auth-submit').textContent = register ? 'Create account' : 'Sign in';
    $('#auth-switch').textContent = register ? 'Already have an account? Sign in' : 'New here? Create an account';
    $('#auth-password').autocomplete = register ? 'new-password' : 'current-password';
    $('#auth-password').minLength = register ? 8 : 1;
    $('#auth-password').value = '';
    $('#auth-password-help').hidden = !register;
    message(ready ? '' : unavailable);
  }
  $('#auth-open').addEventListener('click', () => { setMode(false); dialog.showModal(); });
  $('.footer-signin')?.addEventListener('click', () => $('#main-signin').click());
  $('#main-google')?.addEventListener('click', () => {
    setMode(false);
    dialog.showModal();
    if (ready) $('#auth-google').click();
  });
  $('#main-microsoft')?.addEventListener('click', () => {
    setMode(false);
    dialog.showModal();
    if (ready) $('#auth-microsoft').click();
  });
  $('#main-signin')?.addEventListener('click', () => {
    if (auth?.currentUser) { location.assign('/calendar/preview/'); return; }
    setMode(false); dialog.showModal();
  });
  $('#auth-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { $('#auth-password').value = ''; });
  $('#auth-switch').addEventListener('click', () => setMode(!creating));
  $('#auth-google').addEventListener('click', () => run(async () => {
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await sdk.signInWithPopup(auth, provider);
    dialog.close();
  }));
  $('#auth-microsoft').addEventListener('click', () => run(async () => {
    const provider = new sdk.OAuthProvider('microsoft.com');
    provider.setCustomParameters({prompt:'select_account', tenant:'common'});
    // Identity only. Calendar permissions require a separate connection flow.
    await sdk.signInWithPopup(auth, provider);
    dialog.close();
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
        try { await sdk.sendEmailVerification(credential.user); message('Account created. Check your email to verify your address.'); }
        catch { message('Account created, but the verification email could not be sent. Use Verify email to try again.'); }
      } else {
        await sdk.signInWithEmailAndPassword(auth, email, password);
        dialog.close();
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
  }).then(() => { if (auth?.currentUser) dialog.showModal(); }));
  $('#auth-verify').addEventListener('click', () => {
    dialog.showModal();
    run(async () => {
      if (!auth.currentUser) return;
      await sdk.reload(auth.currentUser);
      renderUser(auth.currentUser);
      if (auth.currentUser.emailVerified) { message('Your email is verified.'); return; }
      await sdk.sendEmailVerification(auth.currentUser);
      message('Verification email sent. After verifying, select Verify email again to refresh your status.');
    });
  });
  function renderUser(user) {
    $('#auth-open').hidden = Boolean(user);
    $('#auth-account').hidden = !user;
    $('#auth-identity').textContent = user?.displayName || user?.email || 'Your account';
    $('#auth-identity').title = user?.email || '';
    $('#auth-verify').hidden = !user || user.emailVerified;
    if ($('#account-storage-note')) $('#account-storage-note').textContent = user
      ? 'Saved locally for this account, on this browser only. Sign-in does not sync meetings across devices.'
      : 'Guest meetings are stored in this browser. Sign in to use a separate local meeting list.';
    if ($('#main-signin')) $('#main-signin').textContent = user ? 'Open calendar preview' : 'Sign in with email';
    if ($('#main-google')) $('#main-google').hidden = Boolean(user);
    if ($('#main-microsoft')) $('#main-microsoft').hidden = Boolean(user);
    if ($('#signin-availability')) $('#signin-availability').textContent = user ? 'Signed in. The calendar currently saves meetings on this device only.' : 'Google, Microsoft or email. No credit card required.';
    // This is a display/storage partition, not authorization. Future server APIs must verify ID tokens.
    document.dispatchEvent(new CustomEvent('crown-auth-change', {detail:{uid:user?.uid || null}}));
  }
  async function initialize() {
    updateControls();
    try {
      const response = await fetch('/calendar/auth-config.json', {cache:'no-store'});
      if (!response.ok) throw new Error('config');
      const {firebase} = await response.json();
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
